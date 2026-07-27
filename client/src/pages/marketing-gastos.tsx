import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import { PageHeader } from "@/components/page-header";
import {
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Monitor,
  Instagram,
  AlertTriangle,
  Pencil,
  Check,
  X,
  DollarSign,
  Plus,
  Trash2,
  ListFilter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Erro desconhecido");
  }
  return res.json() as Promise<T>;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Config ───────────────────────────────────────────────────────────────────

const CHANNELS = [
  {
    id: "whatsapp_disparos",
    label: "WhatsApp Disparos",
    short: "WhatsApp",
    color: "#25D366",
    Icon: MessageCircle,
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    barColor: "#25D366",
  },
  {
    id: "google_ads",
    label: "Google Ads",
    short: "Google Ads",
    color: "#4285F4",
    Icon: Monitor,
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    barColor: "#4285F4",
  },
  {
    id: "meta_ads",
    label: "Meta Ads",
    short: "Meta Ads",
    color: "#A855F7",
    Icon: Instagram,
    bg: "bg-purple-50 dark:bg-purple-900/20",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
    barColor: "#A855F7",
  },
] as const;

type ChannelId = (typeof CHANNELS)[number]["id"];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const formatDateBR = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketingExpense {
  id: string;
  launchedAt: string;
  year: number;
  month: number;
  channel: string;
  amount: string;
  notes: string | null;
}

interface MarketingBudget {
  id: string;
  year: number;
  month: number;
  channel: string;
  budget: string;
}

interface SessionLaunch {
  channel: ChannelId;
  date: string;
  amount: number;
  notes: string;
}

// ─── Budget progress bar ──────────────────────────────────────────────────────

function BudgetBar({ amount, budget }: { amount: number; budget: number | null }) {
  if (!budget || budget <= 0) return null;
  const pct = Math.min((amount / budget) * 100, 100);
  const over = amount > budget;
  return (
    <div className="mt-1.5 space-y-0.5">
      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>{pct.toFixed(0)}% consumido</span>
        <span>/ {formatBRL(budget)}</span>
      </div>
      <Progress
        value={pct}
        className={cn(
          "h-1.5",
          over ? "[&>div]:bg-red-500" : pct >= 80 ? "[&>div]:bg-amber-500" : "",
        )}
      />
    </div>
  );
}

// ─── Budget-only inline cell editor ──────────────────────────────────────────

function BudgetCellEditor({
  initialBudget,
  onSave,
  onCancel,
}: {
  initialBudget: number | null;
  onSave: (budget: string) => void;
  onCancel: () => void;
}) {
  const [budget, setBudget] = useState(initialBudget != null ? String(initialBudget) : "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <div
      className="flex flex-col gap-1 min-w-[110px]"
      onKeyDown={(e) => {
        if (e.key === "Enter") onSave(budget);
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="flex items-center gap-0.5">
        <span className="text-[10px] text-slate-400 w-10">Orç.</span>
        <input
          ref={ref}
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="0"
          className="w-full text-xs border rounded px-1.5 py-0.5 bg-white dark:bg-slate-800 outline-none focus:border-primary"
        />
      </div>
      <div className="flex gap-1 justify-end">
        <button
          onClick={() => onSave(budget)}
          className="p-0.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onCancel}
          className="p-0.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Custom pie tooltip ───────────────────────────────────────────────────────

const PieTooltipContent = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border rounded shadow-md px-3 py-2 text-sm">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-slate-600 dark:text-slate-300">{formatBRL(payload[0].value)}</p>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MarketingGastosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
  const [editingCell, setEditingCell] = useState<{ month: number; channel: ChannelId } | null>(null);

  // ── Novo Lançamento dialog state ────────────────────────────────────────────
  const [newOpen, setNewOpen] = useState(false);
  const [newChannel, setNewChannel] = useState<ChannelId>("whatsapp_disparos");
  const [newDate, setNewDate] = useState(today.toISOString().slice(0, 10));
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [sessionLaunches, setSessionLaunches] = useState<SessionLaunch[]>([]);

  function openNew() {
    setNewChannel("whatsapp_disparos");
    setNewDate(today.toISOString().slice(0, 10));
    setNewAmount("");
    setNewNotes("");
    setSessionLaunches([]);
    setNewOpen(true);
  }

  function resetForm() {
    setNewAmount("");
    setNewNotes("");
  }

  // Guard: admin only
  if (user && user.role !== "admin") return <Redirect to="/dashboard" />;

  const { data: expenses = [], isLoading } = useQuery<MarketingExpense[]>({
    queryKey: ["marketing-expenses", year],
    queryFn: () => apiFetch<MarketingExpense[]>(`/api/marketing-expenses?year=${year}`),
    enabled: !!user,
  });

  const { data: budgets = [] } = useQuery<MarketingBudget[]>({
    queryKey: ["marketing-budgets", year],
    queryFn: () => apiFetch<MarketingBudget[]>(`/api/marketing-expenses/budgets?year=${year}`),
    enabled: !!user,
  });

  // Create individual launch (POST — additive)
  const createMutation = useMutation({
    mutationFn: ({
      launchedAt,
      channel,
      amount,
      notes,
    }: {
      launchedAt: string;
      channel: string;
      amount: string;
      notes: string;
    }) =>
      apiFetch("/api/marketing-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          launchedAt,
          channel,
          amount: parseFloat(amount),
          notes: notes || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-expenses", year] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao lançar", description: e.message, variant: "destructive" }),
  });

  // Set monthly budget (PUT — upsert per month/channel)
  const budgetMutation = useMutation({
    mutationFn: ({
      yr,
      month,
      channel,
      budget,
    }: {
      yr: number;
      month: number;
      channel: string;
      budget: string;
    }) =>
      apiFetch(`/api/marketing-expenses/budgets/${yr}/${month}/${channel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: parseFloat(budget) || 0 }),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-budgets", vars.yr] });
      setEditingCell(null);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Delete individual launch
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/marketing-expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-expenses", year] });
      toast({ title: "Lançamento excluído" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  // Filter state for the launches section
  const [filterChannel, setFilterChannel] = useState<ChannelId | "all">("all");
  const [filterMonth, setFilterMonth] = useState<number | 0>(0); // 0 = all months
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Sum all individual launches for a given month + channel
  function getAmount(month: number, channel: string): number {
    return expenses
      .filter((e) => e.month === month && e.channel === channel)
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  }
  // Monthly budget from the budgets query (separate table)
  function getBudget(month: number, channel: string): number | null {
    const b = budgets.find((b) => b.month === month && b.channel === channel);
    return b ? parseFloat(b.budget) : null;
  }
  function getMonthTotal(month: number): number {
    return CHANNELS.reduce((sum, ch) => sum + getAmount(month, ch.id), 0);
  }
  function getMonthBudgetTotal(month: number): number {
    return CHANNELS.reduce((sum, ch) => sum + (getBudget(month, ch.id) ?? 0), 0);
  }

  // ── Data for charts ───────────────────────────────────────────────────────────

  const pieData = CHANNELS.map((ch) => ({
    name: ch.short,
    value: getAmount(selectedMonth, ch.id),
    color: ch.color,
  })).filter((d) => d.value > 0);

  // Last 6 months (relative to selectedMonth/year)
  const last6: { name: string; month: number; year: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = selectedMonth - i;
    let y = year;
    if (m <= 0) { m += 12; y -= 1; }
    last6.push({ name: MONTH_SHORT[m - 1], month: m, year: y });
  }

  const barData = last6.map(({ name, month, year: y }) => {
    const obj: Record<string, number | string> = { name };
    for (const ch of CHANNELS) {
      const exp = expenses.find((e) => e.year === y && e.month === month && e.channel === ch.id);
      obj[ch.short] = parseFloat(exp?.amount ?? "0");
    }
    return obj;
  });

  // Annual totals
  const yearTotalByChannel = CHANNELS.map((ch) => ({
    ...ch,
    total: CHANNELS.reduce((_, c) =>
      c.id === ch.id
        ? Array.from({ length: 12 }, (_, i) => getAmount(i + 1, c.id)).reduce((s, v) => s + v, 0)
        : 0,
    0),
  }));

  const yearGrandTotal = yearTotalByChannel.reduce(
    (s, ch) =>
      s + Array.from({ length: 12 }, (_, i) => getAmount(i + 1, ch.id)).reduce((a, b) => a + b, 0),
    0,
  );

  const currentMonthTotal = getMonthTotal(selectedMonth);
  const currentMonthBudget = getMonthBudgetTotal(selectedMonth);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon icon={TrendingDown} color="text-primary" bgColor="bg-accent" />
          <PageHeader.Text>
            <PageHeader.Title>Gastos de Marketing</PageHeader.Title>
            <PageHeader.Description>
              Controle de investimentos por canal — admin only
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          <Button onClick={openNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      {/* ── Year navigation ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xl font-bold text-slate-800 dark:text-slate-100 min-w-[60px] text-center">
          {year}
        </span>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Year total pill */}
        <div className="ml-4 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5" />
          Total {year}:{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {formatBRL(yearGrandTotal)}
          </span>
        </div>
      </div>

      {/* ── Month selector ──────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {MONTH_SHORT.map((m, i) => {
          const mn = i + 1;
          const total = getMonthTotal(mn);
          const isFuture = year === today.getFullYear() && mn > today.getMonth() + 1;
          return (
            <button
              key={mn}
              onClick={() => setSelectedMonth(mn)}
              className={cn(
                "flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                selectedMonth === mn
                  ? "bg-primary text-primary-foreground border-primary"
                  : isFuture
                  ? "border-slate-100 text-slate-300 dark:text-slate-600 dark:border-slate-700 cursor-default"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700",
              )}
            >
              <span>{m}</span>
              {total > 0 && (
                <span className={cn("text-[9px] mt-0.5", selectedMonth === mn ? "text-primary-foreground/80" : "text-slate-400")}>
                  {(total / 1000).toFixed(1)}k
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CHANNELS.map((ch) => {
          const amount = getAmount(selectedMonth, ch.id);
          const budget = getBudget(selectedMonth, ch.id);
          const isOver = budget != null && amount > budget;
          return (
            <Card key={ch.id} className={cn("border", isOver && "border-red-300 dark:border-red-700")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn("p-2 rounded-lg", ch.bg)}>
                    <ch.Icon className={cn("h-4 w-4", ch.text)} />
                  </div>
                  {isOver && (
                    <div title="Acima do orçamento">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{ch.label}</p>
                <p className={cn("text-xl font-bold mt-0.5", isOver ? "text-red-600" : "text-slate-800 dark:text-slate-100")}>
                  {formatBRL(amount)}
                </p>
                <BudgetBar amount={amount} budget={budget} />
              </CardContent>
            </Card>
          );
        })}

        {/* Total card */}
        <Card className="border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                <DollarSign className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total {MONTH_NAMES[selectedMonth - 1]}</p>
            <p className="text-xl font-bold mt-0.5 text-slate-800 dark:text-slate-100">
              {formatBRL(currentMonthTotal)}
            </p>
            {currentMonthBudget > 0 && (
              <BudgetBar amount={currentMonthTotal} budget={currentMonthBudget} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Distribuição — {MONTH_NAMES[selectedMonth - 1]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                <TrendingDown className="h-10 w-10 opacity-20" />
                <p className="text-sm">Nenhum gasto registrado neste mês</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip content={<PieTooltipContent />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar chart — last 6 months */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Evolução — últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barGap={2} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={36}
                />
                <ReTooltip
                  formatter={(value: number, name: string) => [formatBRL(value), name]}
                  contentStyle={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>
                  )}
                />
                {CHANNELS.map((ch) => (
                  <Bar key={ch.id} dataKey={ch.short} fill={ch.barColor} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Annual table ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tabela Anual — {year}
            </CardTitle>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Clique em qualquer valor para editar gasto e orçamento
            </p>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-800/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-28">
                  Mês
                </th>
                {CHANNELS.map((ch) => (
                  <th
                    key={ch.id}
                    className="text-right px-4 py-2.5 text-xs font-semibold"
                    style={{ color: ch.color }}
                  >
                    {ch.short}
                  </th>
                ))}
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-28">
                  Total
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-20">
                  % Orç.
                </th>
              </tr>
            </thead>
            <tbody>
              {MONTH_NAMES.map((name, i) => {
                const month = i + 1;
                const isFuture =
                  year === today.getFullYear() && month > today.getMonth() + 1;
                const isCurrent =
                  year === today.getFullYear() && month === today.getMonth() + 1;
                const monthTotal = getMonthTotal(month);
                const monthBudget = getMonthBudgetTotal(month);
                const pctUsed =
                  monthBudget > 0
                    ? Math.round((monthTotal / monthBudget) * 100)
                    : null;

                return (
                  <tr
                    key={month}
                    className={cn(
                      "border-b last:border-0 transition-colors",
                      isFuture
                        ? "opacity-40"
                        : isCurrent
                        ? "bg-primary/5"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/30",
                    )}
                  >
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "font-medium text-sm",
                          isCurrent
                            ? "text-primary"
                            : "text-slate-700 dark:text-slate-300",
                        )}
                      >
                        {name}
                        {isCurrent && (
                          <span className="ml-1.5 text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-semibold">
                            atual
                          </span>
                        )}
                      </span>
                    </td>

                    {CHANNELS.map((ch) => {
                      const amount = getAmount(month, ch.id);
                      const budget = getBudget(month, ch.id);
                      const isEditing =
                        editingCell?.month === month &&
                        editingCell?.channel === ch.id;
                      const isOver = budget != null && amount > budget;

                      return (
                        <td key={ch.id} className="px-3 py-1.5 text-right">
                          {isEditing ? (
                            <BudgetCellEditor
                              initialBudget={budget}
                              onSave={(b) =>
                                budgetMutation.mutate({
                                  yr: year,
                                  month,
                                  channel: ch.id,
                                  budget: b,
                                })
                              }
                              onCancel={() => setEditingCell(null)}
                            />
                          ) : (
                            <button
                              onClick={() =>
                                !isFuture &&
                                setEditingCell({ month, channel: ch.id })
                              }
                              disabled={isFuture}
                              title={!isFuture ? "Clique para definir orçamento" : undefined}
                              className={cn(
                                "group text-right w-full rounded px-1.5 py-1 transition-colors",
                                !isFuture && "hover:bg-slate-100 dark:hover:bg-slate-700",
                              )}
                            >
                              <div className="flex items-center justify-end gap-1">
                                {isOver && (
                                  <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                )}
                                <span
                                  className={cn(
                                    "font-mono text-xs",
                                    amount === 0
                                      ? "text-slate-300 dark:text-slate-600"
                                      : isOver
                                      ? "text-red-600 dark:text-red-400 font-semibold"
                                      : "text-slate-700 dark:text-slate-200",
                                  )}
                                >
                                  {amount === 0 ? "—" : formatBRL(amount)}
                                </span>
                              </div>
                              {budget != null && budget > 0 ? (
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                  <span className="text-[9px] text-slate-400">orç. {formatBRL(budget)}</span>
                                  <Pencil className="h-2 w-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              ) : !isFuture ? (
                                <div className="text-[9px] text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                                  + orçamento
                                </div>
                              ) : null}
                            </button>
                          )}
                        </td>
                      );
                    })}

                    {/* Total */}
                    <td className="px-4 py-2 text-right">
                      <span
                        className={cn(
                          "font-semibold font-mono text-xs",
                          monthTotal === 0
                            ? "text-slate-300 dark:text-slate-600"
                            : "text-slate-800 dark:text-slate-100",
                        )}
                      >
                        {monthTotal === 0 ? "—" : formatBRL(monthTotal)}
                      </span>
                    </td>

                    {/* % budget */}
                    <td className="px-4 py-2 text-right">
                      {pctUsed != null ? (
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            pctUsed > 100
                              ? "text-red-600"
                              : pctUsed >= 80
                              ? "text-amber-600"
                              : "text-green-600",
                          )}
                        >
                          {pctUsed}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Footer — year totals */}
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-600">
                <td className="px-4 py-3 font-bold text-sm text-slate-700 dark:text-slate-300">
                  Total {year}
                </td>
                {CHANNELS.map((ch) => {
                  const total = Array.from({ length: 12 }, (_, i) =>
                    getAmount(i + 1, ch.id),
                  ).reduce((a, b) => a + b, 0);
                  return (
                    <td key={ch.id} className="px-4 py-3 text-right font-bold font-mono text-xs" style={{ color: ch.color }}>
                      {total === 0 ? "—" : formatBRL(total)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right font-bold font-mono text-sm text-slate-800 dark:text-slate-100">
                  {yearGrandTotal === 0 ? "—" : formatBRL(yearGrandTotal)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── Lançamentos individuais ──────────────────────────────────────── */}
      {(() => {
        const filtered = [...expenses]
          .filter((e) => filterChannel === "all" || e.channel === filterChannel)
          .filter((e) => filterMonth === 0 || e.month === filterMonth)
          .sort((a, b) => b.launchedAt.localeCompare(a.launchedAt));

        const filteredTotal = filtered.reduce((s, e) => s + parseFloat(e.amount), 0);

        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <ListFilter className="h-4 w-4 text-slate-400" />
                  Lançamentos — {year}
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({filtered.length} registro{filtered.length !== 1 ? "s" : ""})
                  </span>
                </CardTitle>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  {/* Channel filter */}
                  <div className="flex rounded-lg border overflow-hidden text-xs">
                    <button
                      onClick={() => setFilterChannel("all")}
                      className={cn(
                        "px-2.5 py-1.5 font-medium transition-colors",
                        filterChannel === "all"
                          ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-800"
                          : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700",
                      )}
                    >
                      Todos
                    </button>
                    {CHANNELS.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => setFilterChannel(ch.id)}
                        className={cn(
                          "px-2.5 py-1.5 font-medium transition-colors border-l flex items-center gap-1",
                          filterChannel === ch.id
                            ? "text-white"
                            : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700",
                        )}
                        style={filterChannel === ch.id ? { backgroundColor: ch.color } : {}}
                      >
                        <ch.Icon className="h-3 w-3" />
                        {ch.short}
                      </button>
                    ))}
                  </div>

                  {/* Month filter */}
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                    className="text-xs border rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 outline-none focus:border-primary"
                  >
                    <option value={0}>Todos os meses</option>
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <DollarSign className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Nenhum lançamento encontrado</p>
                  <Button size="sm" variant="outline" onClick={openNew} className="mt-1">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Novo Lançamento
                  </Button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="text-left px-4 py-2.5">Data</th>
                      <th className="text-left px-4 py-2.5">Canal</th>
                      <th className="text-right px-4 py-2.5">Valor</th>
                      <th className="text-left px-4 py-2.5 hidden sm:table-cell">Observações</th>
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => {
                      const ch = CHANNELS.find((c) => c.id === e.channel);
                      const isConfirming = confirmDeleteId === e.id;
                      return (
                        <tr
                          key={e.id}
                          className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          {/* Data */}
                          <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {formatDateBR(e.launchedAt)}
                          </td>

                          {/* Canal */}
                          <td className="px-4 py-2.5">
                            {ch ? (
                              <span
                                className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", ch.bg, ch.text)}
                              >
                                <ch.Icon className="h-3 w-3" />
                                {ch.short}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">{e.channel}</span>
                            )}
                          </td>

                          {/* Valor */}
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {formatBRL(parseFloat(e.amount))}
                          </td>

                          {/* Observações */}
                          <td className="px-4 py-2.5 text-slate-400 text-xs hidden sm:table-cell max-w-[200px] truncate">
                            {e.notes || <span className="italic">—</span>}
                          </td>

                          {/* Excluir */}
                          <td className="px-3 py-2.5 text-right">
                            {isConfirming ? (
                              <div className="flex items-center gap-1 justify-end">
                                <span className="text-[10px] text-slate-500 whitespace-nowrap">Excluir?</span>
                                <button
                                  onClick={() => {
                                    deleteMutation.mutate(e.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(e.id)}
                                className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-600">
                        <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Total filtrado
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-slate-800 dark:text-slate-100">
                          {formatBRL(filteredTotal)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Novo Lançamento Dialog ────────────────────────────────────────── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" />
              Novo Lançamento de Marketing
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 pt-1">
            {/* Canal */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Canal
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map((ch) => {
                  const selected = newChannel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setNewChannel(ch.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border-2 py-3 px-2 transition-all",
                        selected
                          ? ch.bg
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
                      )}
                      style={selected ? { borderColor: ch.color } : {}}
                    >
                      <div className={cn("p-2 rounded-lg", selected ? ch.bg : "bg-slate-100 dark:bg-slate-800")}>
                        <ch.Icon className="h-5 w-5" style={{ color: selected ? ch.color : undefined }} />
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-medium leading-tight text-center",
                          selected ? ch.text : "text-slate-500 dark:text-slate-400",
                        )}
                      >
                        {ch.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Data do lançamento */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Data do lançamento
              </Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Valor */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Valor (R$)
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0,00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="h-9"
                autoFocus
              />
            </div>

            {/* Observações */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Observações{" "}
                <span className="font-normal text-slate-400 normal-case tracking-normal">opcional</span>
              </Label>
              <Textarea
                rows={2}
                placeholder="Ex.: Campanha de remarketing, black friday..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="resize-none text-sm"
              />
            </div>

            {/* Log da sessão */}
            {sessionLaunches.length > 0 && (
              <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/50 p-3 flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Lançamentos desta sessão
                </p>
                {sessionLaunches.map((sl, i) => {
                  const ch = CHANNELS.find((c) => c.id === sl.channel)!;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                        <ch.Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: ch.color }} />
                        <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                          {ch.short} — {formatDateBR(sl.date)}
                          {sl.notes && <span className="text-slate-400"> · {sl.notes}</span>}
                        </span>
                      </div>
                      <span className="text-xs font-semibold font-mono text-slate-700 dark:text-slate-200 flex-shrink-0">
                        {formatBRL(sl.amount)}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-xs text-slate-500">{sessionLaunches.length} lançamento(s) — total:</span>
                  <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-200">
                    {formatBRL(sessionLaunches.reduce((s, l) => s + l.amount, 0))}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1 flex-wrap">
              <Button variant="outline" onClick={() => setNewOpen(false)}>
                Fechar
              </Button>
              <Button
                variant="secondary"
                disabled={!newAmount || parseFloat(newAmount) <= 0 || createMutation.isPending}
                onClick={() => {
                  const ch = CHANNELS.find((c) => c.id === newChannel)!;
                  const amt = parseFloat(newAmount);
                  createMutation.mutate(
                    { launchedAt: newDate, channel: newChannel, amount: newAmount, notes: newNotes },
                    {
                      onSuccess: () => {
                        setSessionLaunches((prev) => [
                          ...prev,
                          { channel: newChannel, date: newDate, amount: amt, notes: newNotes },
                        ]);
                        resetForm();
                        toast({
                          title: "Lançado!",
                          description: `${ch.label} — ${formatBRL(amt)}`,
                        });
                      },
                    },
                  );
                }}
              >
                {createMutation.isPending ? "Salvando..." : "Salvar e Adicionar Mais"}
              </Button>
              <Button
                disabled={!newAmount || parseFloat(newAmount) <= 0 || createMutation.isPending}
                onClick={() => {
                  const ch = CHANNELS.find((c) => c.id === newChannel)!;
                  const amt = parseFloat(newAmount);
                  createMutation.mutate(
                    { launchedAt: newDate, channel: newChannel, amount: newAmount, notes: newNotes },
                    {
                      onSuccess: () => {
                        setNewOpen(false);
                        toast({
                          title: "Lançamento salvo!",
                          description: `${ch.label} — ${formatDateBR(newDate)}: ${formatBRL(amt)}`,
                        });
                      },
                    },
                  );
                }}
              >
                {createMutation.isPending ? "Salvando..." : "Salvar Lançamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
