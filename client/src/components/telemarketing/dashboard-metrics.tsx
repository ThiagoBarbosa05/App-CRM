import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Phone, TrendingUp, Clock, Calendar, Loader2 } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type StatsResponse = {
  summary: {
    total: number;
    hoje: number;
    taxaConversao: number;
    duracaoMedia: number;
  };
  porDia: { date: string; total: number; sim: number; nao: number }[];
  porStatus: { status: string; count: number }[];
  porDecisao: { decisao: string; count: number }[];
  porSentimento: { sentimento: string; count: number }[];
  topCampanhas: {
    campaignId: string;
    campaignName: string;
    total: number;
    sim: number;
    taxaConversao: number;
  }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  iniciando: "Iniciando",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  falhou: "Falhou",
  caixa_postal: "Caixa postal",
};

const STATUS_COLORS: Record<string, string> = {
  iniciando: "#facc15",
  em_andamento: "#3b82f6",
  encerrada: "#10b981",
  nao_atendeu: "#94a3b8",
  ocupado: "#f97316",
  falhou: "#ef4444",
  caixa_postal: "#a855f7",
};

const DECISAO_LABELS: Record<string, string> = {
  sim: "Aceitou",
  nao: "Recusou",
  sem_resposta: "Sem resposta",
};

const DECISAO_COLORS: Record<string, string> = {
  sim: "#10b981",
  nao: "#ef4444",
  sem_resposta: "#94a3b8",
};

const SENTIMENTO_LABELS: Record<string, string> = {
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
};

const SENTIMENTO_COLORS: Record<string, string> = {
  positivo: "#10b981",
  neutro: "#94a3b8",
  negativo: "#ef4444",
};

function formatDuration(s: number): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function DayTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const date = label
    ? format(parseISO(label), "dd 'de' MMMM", { locale: ptBR })
    : "";
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
        {date}
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-slate-500 dark:text-slate-400">
            {p.name === "total"
              ? "Total"
              : p.name === "sim"
                ? "Aceitou"
                : "Recusou"}
            :
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
        </div>
        <div
          className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${bgClass}`}
        >
          <Icon className={`size-5 ${colorClass}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
];

export function DashboardMetrics() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery<StatsResponse>({
    queryKey: ["/api/calls/stats", days],
    queryFn: async () => {
      const res = await fetch(`/api/calls/stats?days=${days}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar estatísticas");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-blue-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Carregando métricas…
          </span>
        </div>
      </div>
    );
  if (!data) return null;

  const {
    summary,
    porDia,
    porStatus,
    porDecisao,
    porSentimento,
    topCampanhas,
  } = data;

  const porStatusLabeled = porStatus.map((s) => ({
    ...s,
    label: STATUS_LABELS[s.status] ?? s.status,
    color: STATUS_COLORS[s.status] ?? "#94a3b8",
  }));

  const porDecisaoLabeled = porDecisao.map((d) => ({
    ...d,
    label: DECISAO_LABELS[d.decisao] ?? d.decisao,
    color: DECISAO_COLORS[d.decisao] ?? "#94a3b8",
  }));

  const porSentimentoLabeled = porSentimento.map((s) => ({
    ...s,
    label: SENTIMENTO_LABELS[s.sentimento] ?? s.sentimento,
    color: SENTIMENTO_COLORS[s.sentimento] ?? "#94a3b8",
  }));

  const chartTickClass = "text-[11px] fill-slate-400";

  return (
    <div className="space-y-6">
      {/* Seletor de período */}
      <div className="flex items-center gap-1.5">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDays(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              days === opt.value
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total chamadas"
          value={String(summary.total)}
          icon={Phone}
          colorClass="text-slate-700 dark:text-slate-200"
          bgClass="bg-slate-100 dark:bg-slate-800"
        />
        <KpiCard
          label="Taxa de conversão"
          value={`${summary.taxaConversao}%`}
          icon={TrendingUp}
          colorClass="text-emerald-600 dark:text-emerald-400"
          bgClass="bg-emerald-50 dark:bg-emerald-900/30"
        />
        <KpiCard
          label="Duração média"
          value={formatDuration(summary.duracaoMedia)}
          icon={Clock}
          colorClass="text-blue-600 dark:text-blue-400"
          bgClass="bg-blue-50 dark:bg-blue-900/30"
        />
        <KpiCard
          label="Chamadas hoje"
          value={String(summary.hoje)}
          icon={Calendar}
          colorClass="text-violet-600 dark:text-violet-400"
          bgClass="bg-violet-50 dark:bg-violet-900/30"
        />
      </div>

      {/* Chamadas por dia */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">
          Chamadas por dia
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart
            data={porDia}
            margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
          >
            <defs>
              <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gSim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gNao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ className: chartTickClass }}
              tickFormatter={(v) => {
                try {
                  return format(parseISO(v), "dd/MM");
                } catch {
                  return v;
                }
              }}
              interval={days <= 7 ? 0 : days <= 30 ? 4 : 9}
            />
            <YAxis tick={{ className: chartTickClass }} allowDecimals={false} />
            <Tooltip content={<DayTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              name="total"
              stroke="#94a3b8"
              strokeWidth={1.5}
              fill="url(#gTotal)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="sim"
              name="sim"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gSim)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="nao"
              name="nao"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#gNao)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 justify-center">
          {[
            { color: "#94a3b8", label: "Total" },
            { color: "#10b981", label: "Aceitou" },
            { color: "#ef4444", label: "Recusou" },
          ].map((l) => (
            <div
              key={l.label}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: l.color }}
              />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Linha 2: Status + Decisão IA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BarChart horizontal — Status */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">
            Distribuição por status
          </p>
          {porStatusLabeled.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs text-slate-400">
              Sem dados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={porStatusLabeled}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
              >
                <XAxis
                  type="number"
                  tick={{ className: chartTickClass }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ className: chartTickClass }}
                  width={90}
                />
                <Tooltip
                  formatter={(v: number) => [v, "Chamadas"]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {porStatusLabeled.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* PieChart donut — Decisão IA */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">
            Decisão IA
          </p>
          {porDecisaoLabeled.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs text-slate-400">
              Sem decisões registradas
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={porDecisaoLabeled}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {porDecisaoLabeled.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [v, "Chamadas"]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-1">
                {porDecisaoLabeled.map((d) => (
                  <div
                    key={d.decisao}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: d.color }}
                      />
                      {d.label}
                    </div>
                    <span
                      className="text-sm font-bold"
                      style={{ color: d.color }}
                    >
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Linha 3: Sentimento + Top Campanhas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PieChart — Sentimento */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">
            Sentimento
          </p>
          {porSentimentoLabeled.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs text-slate-400">
              Sem dados de sentimento
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={porSentimentoLabeled}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {porSentimentoLabeled.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [v, "Chamadas"]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-1">
                {porSentimentoLabeled.map((s) => (
                  <div
                    key={s.sentimento}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: s.color }}
                      />
                      {s.label}
                    </div>
                    <span
                      className="text-sm font-bold"
                      style={{ color: s.color }}
                    >
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tabela — Top Campanhas */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">
            Top campanhas
          </p>
          {topCampanhas.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs text-slate-400">
              Sem campanhas no período
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800">
                <span>Campanha</span>
                <span className="text-right">Total</span>
                <span className="text-right text-emerald-600">Sim</span>
                <span className="text-right">Taxa</span>
              </div>
              {topCampanhas.map((c) => (
                <div
                  key={c.campaignId}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center py-1.5 text-xs border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                >
                  <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                    {c.campaignName}
                  </span>
                  <span className="text-right text-slate-500">{c.total}</span>
                  <span className="text-right text-emerald-600 font-semibold">
                    {c.sim}
                  </span>
                  <span
                    className={`text-right font-bold ${
                      c.taxaConversao >= 50
                        ? "text-emerald-600"
                        : c.taxaConversao >= 25
                          ? "text-amber-500"
                          : "text-red-500"
                    }`}
                  >
                    {c.taxaConversao}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
