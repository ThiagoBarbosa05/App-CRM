import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardCopy,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  buildEventProposal,
  calculateEventBudget,
  DEFAULT_EVENT_MATERIALS,
  DEFAULT_EVENT_TEAM,
  EVENT_BUDGET_FORMATS,
  EVENT_BUDGET_SELECTIONS,
  type EventBudgetDraft,
} from "@shared/event-budget";

type BudgetStatus = "rascunho" | "aprovado" | "arquivado";

interface EventBudget {
  id: string;
  eventId: string | null;
  title: string;
  clientName: string | null;
  status: BudgetStatus;
  participants: number;
  plannedCost: string;
  plannedPrice: string;
  targetMargin: string;
  actualParticipants: number | null;
  revenueOverride: string | null;
  proposalText: string | null;
  calculatorData: Record<string, unknown>;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EventCost {
  id: string;
  category: string;
  spentOn: string | null;
  supplier: string | null;
  description: string;
  quantity: string;
  unit: string;
  unitValue: string;
  isPaid: boolean;
}

interface BudgetDetail {
  budget: EventBudget;
  costs: EventCost[];
  summary: {
    totalCost: number;
    paidCost: number;
    openCost: number;
    costPerParticipant: number;
    revenue: number;
    result: number;
    marginPercent: number;
    plannedCost: number;
    plannedPrice: number;
    participants: number;
    byCategory: Record<string, number>;
  };
}

const MONEY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const formatMoney = (value: number) => MONEY.format(value || 0);
const numberFrom = (value: string | number | null | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const COST_CATEGORIES = [
  ["queijos", "Queijos"],
  ["frios", "Frios e embutidos"],
  ["paes", "Pães e acompanhamentos"],
  ["vinho", "Vinhos"],
  ["equipe", "Equipe"],
  ["materiais", "Materiais e locação"],
  ["transporte", "Transporte e montagem"],
  ["outros", "Outros"],
] as const;

const emptyDraft = (): EventBudgetDraft => ({
  participants: 20,
  duration: 3,
  format: "coquetel",
  selection: "premium",
  winePerPerson: 0.8,
  targetMargin: 40,
  manualPrice: null,
  team: DEFAULT_EVENT_TEAM.map((line) => ({ ...line })),
  materials: DEFAULT_EVENT_MATERIALS.map((line) => ({ ...line })),
});

function readDraft(budget: EventBudget): EventBudgetDraft {
  const data = budget.calculatorData as Partial<EventBudgetDraft>;
  return {
    ...emptyDraft(),
    ...data,
    participants: numberFrom(data.participants, budget.participants),
    targetMargin: numberFrom(data.targetMargin, budget.targetMargin),
    team: Array.isArray(data.team) && data.team.length ? data.team : emptyDraft().team,
    materials:
      Array.isArray(data.materials) && data.materials.length
        ? data.materials
        : emptyDraft().materials,
    proposalText: budget.proposalText ?? data.proposalText,
  };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: options?.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options?.headers,
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message ?? "Não foi possível concluir a operação");
  }
  return response.json() as Promise<T>;
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "wine" | "positive" | "negative" }) {
  const toneClass = {
    neutral: "border-stone-200 bg-stone-50 text-stone-950 dark:border-stone-800 dark:bg-stone-900",
    wine: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30",
    negative: "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30",
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function EventBudgetsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initialEventId = new URLSearchParams(window.location.search).get("eventId");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [title, setTitle] = useState("Nova estação de queijos e vinhos");
  const [clientName, setClientName] = useState("");
  const [eventId, setEventId] = useState<string | null>(initialEventId);
  const [draft, setDraft] = useState<EventBudgetDraft>(emptyDraft);
  const [revenueOverride, setRevenueOverride] = useState("");
  const [actualParticipants, setActualParticipants] = useState("");
  const [costForm, setCostForm] = useState({
    category: "outros",
    description: "",
    supplier: "",
    quantity: "1",
    unit: "un",
    unitValue: "",
    spentOn: "",
  });
  const [editingCost, setEditingCost] = useState<EventCost | null>(null);

  const { data: budgets = [], isLoading: isLoadingBudgets } = useQuery<EventBudget[]>({
    queryKey: ["/api/event-budgets"],
  });
  const { data: detail, isLoading: isLoadingDetail } = useQuery<BudgetDetail>({
    queryKey: ["/api/event-budgets", selectedId],
    queryFn: () => apiFetch(`/api/event-budgets/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const calculation = useMemo(() => calculateEventBudget(draft), [draft]);

  const hydrate = (budget: EventBudget) => {
    setSelectedId(budget.id);
    setIsNew(false);
    setTitle(budget.title);
    setClientName(budget.clientName ?? "");
    setEventId(budget.eventId);
    setDraft(readDraft(budget));
    setRevenueOverride(budget.revenueOverride ?? "");
    setActualParticipants(budget.actualParticipants?.toString() ?? "");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const proposalText = draft.proposalText?.trim() || buildEventProposal(draft, calculation, clientName);
      const payload = {
        eventId,
        title,
        clientName: clientName || null,
        participants: calculation.participants,
        plannedCost: calculation.plannedCost.toFixed(2),
        plannedPrice: calculation.plannedPrice.toFixed(2),
        targetMargin: calculation.marginPercent.toFixed(2),
        proposalText,
        calculatorData: { ...draft, proposalText },
      };
      return isNew
        ? apiFetch<EventBudget>("/api/event-budgets", {
            method: "POST",
            body: JSON.stringify(payload),
          })
        : apiFetch<EventBudget>(`/api/event-budgets/${selectedId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/event-budgets", budget.id] });
      hydrate(budget);
      toast({ title: "Orçamento salvo", description: "O planejamento está disponível para aprovação e controle real." });
    },
    onError: (error) => toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }),
  });

  const updateActualsMutation = useMutation({
    mutationFn: () =>
      apiFetch<EventBudget>(`/api/event-budgets/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify({
          actualParticipants: actualParticipants ? Number(actualParticipants) : null,
          revenueOverride: revenueOverride ? Number(revenueOverride).toFixed(2) : null,
        }),
      }),
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/event-budgets", budget.id] });
      hydrate(budget);
      toast({ title: "Resultado realizado atualizado" });
    },
    onError: (error) =>
      toast({ title: "Não foi possível atualizar o resultado", description: error.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: () => apiFetch<EventBudget>(`/api/event-budgets/${selectedId}/approve`, { method: "POST" }),
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/event-budgets", budget.id] });
      toast({ title: "Orçamento aprovado", description: "A receita planejada agora é a referência do resultado real." });
    },
    onError: (error) => toast({ title: "Não foi possível aprovar", description: error.message, variant: "destructive" }),
  });

  const addCostMutation = useMutation({
    mutationFn: () =>
      apiFetch<EventCost>(`/api/event-budgets/${selectedId}/costs`, {
        method: "POST",
        body: JSON.stringify(costForm),
      }),
    onSuccess: () => {
      setCostForm({ category: "outros", description: "", supplier: "", quantity: "1", unit: "un", unitValue: "", spentOn: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/event-budgets", selectedId] });
      toast({ title: "Custo registrado" });
    },
    onError: (error) => toast({ title: "Não foi possível registrar", description: error.message, variant: "destructive" }),
  });

  const updateCost = useMutation({
    mutationFn: ({ costId, payload }: { costId: string; payload: Partial<EventCost> }) =>
      apiFetch<EventCost>(`/api/event-budgets/${selectedId}/costs/${costId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/event-budgets", selectedId] }),
  });

  const deleteCost = useMutation({
    mutationFn: (costId: string) => apiFetch(`/api/event-budgets/${selectedId}/costs/${costId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/event-budgets", selectedId] }),
  });

  const startNew = () => {
    setSelectedId(null);
    setIsNew(true);
    setTitle("Nova estação de queijos e vinhos");
    setClientName("");
    setEventId(initialEventId);
    setDraft(emptyDraft());
    setRevenueOverride("");
    setActualParticipants("");
  };

  const copyProposal = async () => {
    const text = draft.proposalText?.trim() || buildEventProposal(draft, calculation, clientName);
    await navigator.clipboard.writeText(text);
    toast({ title: "Proposta copiada" });
  };

  const exportCostsCsv = () => {
    if (!detail) return;
    const rows = [
      ["Categoria", "Data", "Fornecedor", "Descrição", "Qtd", "Unidade", "Valor unitário", "Total", "Situação"],
      ...detail.costs.map((cost) => [
        COST_CATEGORIES.find(([key]) => key === cost.category)?.[1] ?? cost.category,
        cost.spentOn ?? "",
        cost.supplier ?? "",
        cost.description,
        cost.quantity,
        cost.unit,
        cost.unitValue,
        (numberFrom(cost.quantity, 1) * numberFrom(cost.unitValue)).toFixed(2),
        cost.isPaid ? "Pago" : "Em aberto",
      ]),
    ];
    const csv = "\ufeff" + rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `custos-${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const status = detail?.budget.status;
  const isApproved = status === "aprovado";

  return (
    <div className="space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon icon={Wine} color="text-rose-800" bgColor="bg-rose-100 dark:bg-rose-950/50" />
          <PageHeader.Text>
            <PageHeader.Title>Orçamentos de Eventos</PageHeader.Title>
            <PageHeader.Description>
              Planeje a estação, feche a proposta e acompanhe o custo realizado no mesmo fluxo.
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          <Button variant="outline" onClick={() => navigate("/eventos")}>Voltar aos eventos</Button>
          <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />Novo orçamento</Button>
        </PageHeader.Actions>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Salvos</p>
            <Badge variant="secondary">{budgets.length}</Badge>
          </div>
          <div className="space-y-2">
            {isLoadingBudgets ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : budgets.map((budget) => (
              <button
                key={budget.id}
                onClick={() => hydrate(budget)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selectedId === budget.id ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30" : "border-border bg-card hover:border-rose-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold">{budget.title}</p>
                  <Badge className={budget.status === "aprovado" ? "bg-emerald-600" : "bg-stone-500"}>
                    {budget.status === "aprovado" ? "Aprovado" : "Rascunho"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{budget.participants} convidados · {formatMoney(numberFrom(budget.plannedPrice))}</p>
              </button>
            ))}
            {!isLoadingBudgets && budgets.length === 0 && (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Salve a primeira simulação para criar sua base de custos.</p>
            )}
          </div>
        </aside>

        <main className="space-y-6">
          <Card className="overflow-hidden border-stone-200 dark:border-stone-800">
            <div className="border-b bg-[linear-gradient(115deg,#3f111e,#742139_55%,#b27b33)] px-6 py-5 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Planejamento estimado</p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold">Estação de sabores, preço seguro</h2>
                </div>
                {isNew ? <Badge className="bg-white/15 text-white hover:bg-white/15">Simulação nova</Badge> : <Badge className={isApproved ? "bg-emerald-600" : "bg-white/15 text-white hover:bg-white/15"}>{isApproved ? "Aprovado" : "Rascunho"}</Badge>}
              </div>
            </div>
            <CardContent className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Nome do orçamento</Label><Input disabled={isApproved} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
                <div className="space-y-2"><Label>Cliente ou empresa</Label><Input disabled={isApproved} value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Opcional" /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2"><Label>Convidados</Label><Input disabled={isApproved} type="number" min="1" value={draft.participants} onChange={(event) => setDraft((prev) => ({ ...prev, participants: numberFrom(event.target.value, 1) }))} /></div>
                <div className="space-y-2"><Label>Duração</Label><Select disabled={isApproved} value={String(draft.duration)} onValueChange={(value) => setDraft((prev) => ({ ...prev, duration: Number(value) as 2 | 3 | 4 | 5 }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[2,3,4,5].map((value) => <SelectItem key={value} value={String(value)}>{value} horas</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Formato</Label><Select disabled={isApproved} value={draft.format} onValueChange={(value) => setDraft((prev) => ({ ...prev, format: value as EventBudgetDraft["format"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EVENT_BUDGET_FORMATS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Seleção</Label><Select disabled={isApproved} value={draft.selection} onValueChange={(value) => setDraft((prev) => ({ ...prev, selection: value as EventBudgetDraft["selection"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EVENT_BUDGET_SELECTIONS).map(([value, item]) => <SelectItem key={value} value={value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              </div>

              <div className="grid gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-900/50 sm:grid-cols-3">
                <div className="space-y-2"><Label>Garrafas por convidado</Label><Input disabled={isApproved} type="number" step="0.1" min="0" value={draft.winePerPerson} onChange={(event) => setDraft((prev) => ({ ...prev, winePerPerson: numberFrom(event.target.value) }))} /></div>
                <div className="space-y-2"><Label>Margem alvo (%)</Label><Input disabled={isApproved} type="number" min="0" max="95" value={draft.targetMargin} onChange={(event) => setDraft((prev) => ({ ...prev, targetMargin: numberFrom(event.target.value) }))} /></div>
                <div className="space-y-2"><Label>Preço fechado (opcional)</Label><Input disabled={isApproved} type="number" min="0" step="10" placeholder="Calculado automaticamente" value={draft.manualPrice ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, manualPrice: event.target.value ? numberFrom(event.target.value) : null }))} /></div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Insumos" value={formatMoney(calculation.suppliesTotal)} />
                <Metric label="Operação" value={formatMoney(calculation.operationTotal)} />
                <Metric label="Custo previsto" value={formatMoney(calculation.plannedCost)} tone="wine" />
                <Metric label={`Preço · ${calculation.marginPercent.toFixed(0)}%`} value={formatMoney(calculation.plannedPrice)} tone="positive" />
              </div>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {formatMoney(calculation.pricePerPerson)} por convidado · {calculation.bottles} garrafas · {calculation.shoppingList.slice(0, 4).map((item) => `${item.name}: ${item.quantity}`).join(" · ")}
              </p>

              <div className="grid gap-5 lg:grid-cols-2">
                <LineEditor title="Equipe" lines={draft.team ?? []} disabled={isApproved} onChange={(team) => setDraft((prev) => ({ ...prev, team }))} />
                <LineEditor title="Materiais" lines={draft.materials ?? []} disabled={isApproved} onChange={(materials) => setDraft((prev) => ({ ...prev, materials }))} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3"><Label>Texto da proposta</Label><Button disabled={isApproved} size="sm" variant="ghost" onClick={() => setDraft((prev) => ({ ...prev, proposalText: buildEventProposal({ ...prev, proposalText: "" }, calculation, clientName) }))}>Gerar de novo</Button></div>
                <Textarea disabled={isApproved} className="min-h-56 font-mono text-xs leading-relaxed" value={draft.proposalText ?? buildEventProposal(draft, calculation, clientName)} onChange={(event) => setDraft((prev) => ({ ...prev, proposalText: event.target.value }))} />
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-5">
                <Button onClick={() => saveMutation.mutate()} disabled={isApproved || saveMutation.isPending || !title.trim()}>{saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}{isNew ? "Salvar orçamento" : "Salvar alterações"}</Button>
                <Button variant="outline" onClick={copyProposal}><ClipboardCopy className="mr-2 h-4 w-4" />Copiar proposta</Button>
                <Button variant="outline" onClick={() => window.print()}><FileDown className="mr-2 h-4 w-4" />Imprimir proposta</Button>
                {!isNew && !isApproved && <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar orçamento</Button>}
              </div>
            </CardContent>
          </Card>

          {!isNew && (
            <Card className="border-stone-200 dark:border-stone-800">
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-rose-700" />Controle de custos reais</CardTitle><p className="mt-1 text-sm text-muted-foreground">Compare o que foi planejado com cada gasto efetivamente lançado.</p></div>
                  {detail && <Button variant="outline" size="sm" onClick={exportCostsCsv}><FileDown className="mr-2 h-4 w-4" />Baixar CSV</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                {!isApproved ? (
                  <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Aprove o orçamento para iniciar o controle realizado. A receita aprovada será preenchida como referência e poderá ser ajustada se o evento mudar.</div>
                ) : isLoadingDetail ? <Loader2 className="h-5 w-5 animate-spin" /> : detail && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2"><Label>Participantes realizados</Label><Input type="number" min="1" placeholder={String(detail.budget.participants)} value={actualParticipants} onChange={(event) => setActualParticipants(event.target.value)} onBlur={() => updateActualsMutation.mutate()} /></div>
                      <div className="space-y-2"><Label>Receita realizada (ajuste explícito)</Label><Input type="number" min="0" step="0.01" placeholder={detail.budget.plannedPrice} value={revenueOverride} onChange={(event) => setRevenueOverride(event.target.value)} onBlur={() => updateActualsMutation.mutate()} /></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric label="Planejado" value={formatMoney(detail.summary.plannedCost)} />
                      <Metric label="Realizado" value={formatMoney(detail.summary.totalCost)} tone={detail.summary.totalCost > detail.summary.plannedCost ? "negative" : "positive"} />
                      <Metric label="Em aberto" value={formatMoney(detail.summary.openCost)} tone={detail.summary.openCost > 0 ? "negative" : "neutral"} />
                      <Metric label="Resultado" value={formatMoney(detail.summary.result)} tone={detail.summary.result >= 0 ? "positive" : "negative"} />
                    </div>
                    <div className="rounded-xl border bg-stone-50 p-4 dark:bg-stone-900/50"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Composição do gasto</p><div className="mt-3 flex h-3 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">{Object.entries(detail.summary.byCategory).map(([category, total], index) => <div key={category} title={`${category}: ${formatMoney(total)}`} style={{ width: `${detail.summary.totalCost ? total / detail.summary.totalCost * 100 : 0}%`, backgroundColor: ["#7f1d1d","#b45309","#a16207","#4d7c0f","#0f766e","#0369a1","#6d28d9","#57534e"][index % 8] }} />)}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{Object.entries(detail.summary.byCategory).map(([category,total]) => <span key={category}>{COST_CATEGORIES.find(([key]) => key === category)?.[1] ?? category}: <b>{formatMoney(total)}</b></span>)}</div></div>

                    <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-800">
                      <p className="mb-3 text-sm font-semibold">Novo lançamento</p>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Select value={costForm.category} onValueChange={(category) => setCostForm((prev) => ({ ...prev, category }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COST_CATEGORIES.map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                        <Input placeholder="Descrição" value={costForm.description} onChange={(event) => setCostForm((prev) => ({ ...prev, description: event.target.value }))} />
                        <Input placeholder="Fornecedor" value={costForm.supplier} onChange={(event) => setCostForm((prev) => ({ ...prev, supplier: event.target.value }))} />
                        <Input type="date" value={costForm.spentOn} onChange={(event) => setCostForm((prev) => ({ ...prev, spentOn: event.target.value }))} />
                        <Input type="number" min="0.001" step="0.001" placeholder="Qtd." value={costForm.quantity} onChange={(event) => setCostForm((prev) => ({ ...prev, quantity: event.target.value }))} />
                        <Input placeholder="Unidade" value={costForm.unit} onChange={(event) => setCostForm((prev) => ({ ...prev, unit: event.target.value }))} />
                        <Input type="number" min="0" step="0.01" placeholder="Valor unitário" value={costForm.unitValue} onChange={(event) => setCostForm((prev) => ({ ...prev, unitValue: event.target.value }))} />
                        <Button onClick={() => addCostMutation.mutate()} disabled={!costForm.description || !costForm.unitValue || addCostMutation.isPending}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
                      </div>
                    </div>

                    {editingCost && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
                        <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-semibold">Editar lançamento</p><Button size="sm" variant="ghost" onClick={() => setEditingCost(null)}>Cancelar</Button></div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <Select value={editingCost.category} onValueChange={(category) => setEditingCost((current) => current ? { ...current, category } : current)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COST_CATEGORIES.map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                          <Input placeholder="Descrição" value={editingCost.description} onChange={(event) => setEditingCost((current) => current ? { ...current, description: event.target.value } : current)} />
                          <Input placeholder="Fornecedor" value={editingCost.supplier ?? ""} onChange={(event) => setEditingCost((current) => current ? { ...current, supplier: event.target.value } : current)} />
                          <Input type="date" value={editingCost.spentOn ?? ""} onChange={(event) => setEditingCost((current) => current ? { ...current, spentOn: event.target.value } : current)} />
                          <Input type="number" min="0.001" step="0.001" value={editingCost.quantity} onChange={(event) => setEditingCost((current) => current ? { ...current, quantity: event.target.value } : current)} />
                          <Input value={editingCost.unit} onChange={(event) => setEditingCost((current) => current ? { ...current, unit: event.target.value } : current)} />
                          <Input type="number" min="0" step="0.01" value={editingCost.unitValue} onChange={(event) => setEditingCost((current) => current ? { ...current, unitValue: event.target.value } : current)} />
                          <Button onClick={() => updateCost.mutate({ costId: editingCost.id, payload: { category: editingCost.category, description: editingCost.description, supplier: editingCost.supplier, spentOn: editingCost.spentOn, quantity: editingCost.quantity, unit: editingCost.unit, unitValue: editingCost.unitValue } }, { onSuccess: () => setEditingCost(null) })} disabled={!editingCost.description || !editingCost.unitValue || updateCost.isPending}><Pencil className="mr-2 h-4 w-4" />Salvar edição</Button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-muted-foreground dark:bg-stone-900"><tr><th className="p-3">Item</th><th className="p-3">Categoria</th><th className="p-3">Fornecedor</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Pago</th><th className="p-3" /></tr></thead>
                        <tbody>{detail.costs.map((cost) => <tr key={cost.id} className="border-t"><td className="p-3"><p className="font-medium">{cost.description}</p><p className="text-xs text-muted-foreground">{cost.quantity} {cost.unit} × {formatMoney(numberFrom(cost.unitValue))}</p></td><td className="p-3">{COST_CATEGORIES.find(([key]) => key === cost.category)?.[1] ?? cost.category}</td><td className="p-3 text-muted-foreground">{cost.supplier || "—"}</td><td className="p-3 text-right font-semibold tabular-nums">{formatMoney(numberFrom(cost.quantity, 1) * numberFrom(cost.unitValue))}</td><td className="p-3 text-center"><input aria-label={`Marcar ${cost.description} como pago`} type="checkbox" checked={cost.isPaid} onChange={(event) => updateCost.mutate({ costId: cost.id, payload: { isPaid: event.target.checked } })} /></td><td className="p-3 text-right"><Button aria-label={`Editar ${cost.description}`} variant="ghost" size="icon" onClick={() => setEditingCost(cost)}><Pencil className="h-4 w-4" /></Button><Button aria-label={`Remover ${cost.description}`} variant="ghost" size="icon" onClick={() => deleteCost.mutate(cost.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td></tr>)}</tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function LineEditor({
  title,
  lines,
  disabled = false,
  onChange,
}: {
  title: string;
  lines: NonNullable<EventBudgetDraft["team"]>;
  disabled?: boolean;
  onChange: (lines: NonNullable<EventBudgetDraft["team"]>) => void;
}) {
  const update = (index: number, field: "quantity" | "unitPrice", value: string) => {
    onChange(lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value === "" ? null : numberFrom(value) } : line));
  };
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-800">
      <div className="flex items-center gap-2 border-b px-4 py-3"><UtensilsCrossed className="h-4 w-4 text-rose-700" /><p className="text-sm font-semibold">{title}</p></div>
      <div className="divide-y">{lines.map((line, index) => <div key={line.id} className="grid grid-cols-[1fr_78px_86px] items-center gap-2 px-4 py-2"><span className="text-sm">{line.name}</span><Input disabled={disabled} aria-label={`Quantidade de ${line.name}`} type="number" min="0" placeholder="Auto" value={line.quantity ?? ""} onChange={(event) => update(index, "quantity", event.target.value)} /><Input disabled={disabled} aria-label={`Valor de ${line.name}`} type="number" min="0" value={line.unitPrice} onChange={(event) => update(index, "unitPrice", event.target.value)} /></div>)}</div>
    </div>
  );
}