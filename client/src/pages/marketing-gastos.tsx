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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketingExpense {
  id: string;
  year: number;
  month: number;
  channel: string;
  amount: string;
  budget: string | null;
  notes: string | null;
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

// ─── Inline cell editor ───────────────────────────────────────────────────────

function CellEditor({
  initialAmount,
  initialBudget,
  onSave,
  onCancel,
}: {
  initialAmount: number;
  initialBudget: number | null;
  onSave: (amount: string, budget: string) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(initialAmount > 0 ? String(initialAmount) : "");
  const [budget, setBudget] = useState(initialBudget != null ? String(initialBudget) : "");
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
    amountRef.current?.select();
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave(amount, budget);
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="flex flex-col gap-1 min-w-[130px]" onKeyDown={handleKey}>
      <div className="flex items-center gap-0.5">
        <span className="text-[10px] text-slate-400 w-12">Gasto</span>
        <input
          ref={amountRef}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full text-xs border rounded px-1.5 py-0.5 bg-white dark:bg-slate-800 outline-none focus:border-primary"
        />
      </div>
      <div className="flex items-center gap-0.5">
        <span className="text-[10px] text-slate-400 w-12">Orç.</span>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="0"
          className="w-full text-xs border rounded px-1.5 py-0.5 bg-white dark:bg-slate-800 outline-none focus:border-primary"
        />
      </div>
      <div className="flex gap-1 justify-end">
        <button
          onClick={() => onSave(amount, budget)}
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

  // Guard: admin only
  if (user && user.role !== "admin") return <Redirect to="/dashboard" />;

  const { data: expenses = [], isLoading } = useQuery<MarketingExpense[]>({
    queryKey: ["marketing-expenses", year],
    queryFn: () => apiFetch<MarketingExpense[]>(`/api/marketing-expenses?year=${year}`),
    enabled: !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: ({
      month,
      channel,
      amount,
      budget,
    }: {
      month: number;
      channel: string;
      amount: string;
      budget: string;
    }) =>
      apiFetch(`/api/marketing-expenses/${year}/${month}/${channel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount) || 0,
          budget: budget ? parseFloat(budget) : null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-expenses", year] });
      setEditingCell(null);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getExpense(month: number, channel: string) {
    return expenses.find((e) => e.month === month && e.channel === channel) ?? null;
  }
  function getAmount(month: number, channel: string): number {
    return parseFloat(getExpense(month, channel)?.amount ?? "0");
  }
  function getBudget(month: number, channel: string): number | null {
    const b = getExpense(month, channel)?.budget;
    return b ? parseFloat(b) : null;
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
                            <CellEditor
                              initialAmount={amount}
                              initialBudget={budget}
                              onSave={(a, b) =>
                                upsertMutation.mutate({
                                  month,
                                  channel: ch.id,
                                  amount: a,
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
                              className={cn(
                                "group text-right w-full rounded px-1.5 py-1 transition-colors",
                                !isFuture &&
                                  "hover:bg-slate-100 dark:hover:bg-slate-700",
                              )}
                            >
                              <div className="flex items-center justify-end gap-1">
                                {isOver && (
                                  <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                )}
                                {amount === 0 ? (
                                <span className="text-xs text-slate-300 dark:text-slate-600 group-hover:text-primary group-hover:font-medium transition-colors">
                                  + Lançar
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    "font-mono text-xs",
                                    isOver
                                      ? "text-red-600 dark:text-red-400 font-semibold"
                                      : "text-slate-700 dark:text-slate-200",
                                  )}
                                >
                                  {formatBRL(amount)}
                                </span>
                              )}
                                {!isFuture && (
                                  <Pencil className="h-2.5 w-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                )}
                              </div>
                              {budget != null && budget > 0 && (
                                <div className="text-[9px] text-slate-400 mt-0.5">
                                  / {formatBRL(budget)}
                                </div>
                              )}
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
    </div>
  );
}
