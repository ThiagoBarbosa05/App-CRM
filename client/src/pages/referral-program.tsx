import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Share2,
  Users,
  ShoppingBag,
  TrendingUp,
  Gift,
  Clock,
  MessageSquare,
  Search,
  ChevronDown,
  ChevronUp,
  Trophy,
  Star,
  CircleHelp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { cn, formatPhone, formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgramReferral {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerResponsavelId: string | null;
  referrerResponsavelName: string | null;
  referredName: string;
  referredPhone: string;
  referredClientId: string | null;
  messageSent: boolean;
  hasPurchased: boolean;
  purchasedAt: string | null;
  createdAt: string;
  benefit1DeliveredAt: string | null;
  benefit2DeliveredAt: string | null;
}

interface ProgramStats {
  totalReferrals: number;
  totalPurchased: number;
  conversionRate: number;
  clientsWithBenefit1: number;
  clientsWithBenefit2: number;
}

interface ProgramData {
  referrals: ProgramReferral[];
  stats: ProgramStats;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-sm flex items-start gap-3 sm:gap-4 hover:shadow-md transition-shadow duration-200">
      <div
        className={cn(
          "h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner mt-0.5",
          bg,
        )}
      >
        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", color)} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide sm:tracking-widest leading-tight">
          {label}
        </p>
        <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
          {value}
        </p>
        {sub && (
          <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Rules Section ────────────────────────────────────────────────────────────

function RulesSection() {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <CircleHelp className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Como funciona o Programa de Indicação
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 dark:border-slate-800 pt-5">
          {/* Como funciona */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Passo a passo
            </h3>
            <ol className="space-y-3">
              {[
                {
                  step: "1",
                  text: "O cliente acessa seu perfil na aba Indicações e cadastra um amigo (nome + WhatsApp).",
                },
                {
                  step: "2",
                  text: 'O sistema cria o perfil do indicado automaticamente com origem "Indicação".',
                },
                {
                  step: "3",
                  text: "Uma mensagem é enviada pelo WhatsApp para o indicado informando quem o recomendou.",
                },
                {
                  step: "4",
                  text: "Quando o indicado faz uma compra, a indicação é marcada como convertida automaticamente.",
                },
                {
                  step: "5",
                  text: "Ao atingir os thresholds, o vendedor marca o benefício como entregue no perfil do cliente.",
                },
              ].map(({ step, text }) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="h-5 w-5 rounded-full bg-accent text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {step}
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {text}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* Benefícios */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Benefícios para o cliente indicador
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Benefício 1 — Desconto Especial
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ao indicar <strong>3 amigos</strong> (independente de
                    comprarem), o cliente ganha um{" "}
                    <strong>desconto especial</strong> na próxima compra.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                  <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Benefício 2 — Brinde Especial
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ao ter{" "}
                    <strong>3 indicados que realizaram uma compra</strong>, o
                    cliente ganha um <strong>brinde especial</strong> exclusivo.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <Star className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Os benefícios são cumulativos — o cliente pode conquistar
                  ambos. O vendedor responsável marca a entrega no perfil do
                  cliente ao conceder o benefício.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReferralProgramPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "purchased" | "pending"
  >("all");
  const [responsavelFilter, setResponsavelFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<ProgramData>({
    queryKey: ["/api/referrals/program"],
  });

  const responsaveisOptions = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    data.referrals.forEach((r) => {
      if (r.referrerResponsavelId && r.referrerResponsavelName) {
        map.set(r.referrerResponsavelId, r.referrerResponsavelName);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.toLowerCase();
    return data.referrals.filter((r) => {
      const matchesSearch =
        !search ||
        r.referredName.toLowerCase().includes(term) ||
        r.referrerName.toLowerCase().includes(term) ||
        (r.referrerResponsavelName ?? "").toLowerCase().includes(term) ||
        r.referredPhone.includes(search.replace(/\D/g, ""));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "purchased" && r.hasPurchased) ||
        (statusFilter === "pending" && !r.hasPurchased);

      const matchesResponsavel =
        responsavelFilter === "all" ||
        r.referrerResponsavelId === responsavelFilter;

      return matchesSearch && matchesStatus && matchesResponsavel;
    });
  }, [data, search, statusFilter, responsavelFilter]);

  const stats = data?.stats;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={Share2}
            color="text-primary"
            bgColor="bg-accent"
          />
          <PageHeader.Text>
            <PageHeader.Title>Programa de Indicação</PageHeader.Title>
            <PageHeader.Description>
              {user?.role === "vendedor"
                ? "Acompanhe as indicações feitas pelos seus clientes"
                : "Visão geral de todas as indicações do programa"}
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total de Indicações"
            value={stats?.totalReferrals ?? 0}
            icon={Users}
            color="text-indigo-600 dark:text-indigo-400"
            bg="bg-indigo-50 dark:bg-indigo-900/20"
          />
          <StatCard
            label="Compraram"
            value={stats?.totalPurchased ?? 0}
            sub={`de ${stats?.totalReferrals ?? 0} indicados`}
            icon={ShoppingBag}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-50 dark:bg-emerald-900/20"
          />
          <StatCard
            label="Taxa de Conversão"
            value={`${stats?.conversionRate ?? 0}%`}
            icon={TrendingUp}
            color="text-blue-600 dark:text-blue-400"
            bg="bg-blue-50 dark:bg-blue-900/20"
          />
          <StatCard
            label="Benefícios Conquistados"
            value={
              (stats?.clientsWithBenefit1 ?? 0) +
              (stats?.clientsWithBenefit2 ?? 0)
            }
            sub={`B1: ${stats?.clientsWithBenefit1 ?? 0} · B2: ${stats?.clientsWithBenefit2 ?? 0} clientes`}
            icon={Trophy}
            color="text-amber-600 dark:text-amber-400"
            bg="bg-amber-50 dark:bg-amber-900/20"
          />
        </div>
      )}

      {/* Rules */}
      <RulesSection />

      {/* Referrals Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar indicado, indicador ou responsável..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="h-8 text-sm w-full sm:w-52">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="purchased">Compraram</SelectItem>
              <SelectItem value="pending">Ainda não comprou</SelectItem>
            </SelectContent>
          </Select>
          {user?.role !== "vendedor" && responsaveisOptions.length > 0 && (
            <Select
              value={responsavelFilter}
              onValueChange={setResponsavelFilter}
            >
              <SelectTrigger className="h-8 text-sm w-full sm:w-52">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {responsaveisOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500 shrink-0 sm:ml-auto">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto] gap-4 px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          <span>Indicado</span>
          <span>Quem Indicou</span>
          <span>Responsável</span>
          <span>Status</span>
          <span>Data</span>
          <span />
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4">
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
            {search || statusFilter !== "all"
              ? "Nenhuma indicação encontrada para os filtros selecionados."
              : "Nenhuma indicação registrada ainda."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto] gap-3 sm:gap-4 items-start sm:items-center px-5 py-4 sm:py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                {/* Indicado */}
                <div className="min-w-0">
                  <p className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Indicado</p>
                  <div
                    className={cn(
                      "flex items-center gap-3 min-w-0",
                      r.referredClientId && "cursor-pointer group",
                    )}
                    onClick={() =>
                      r.referredClientId &&
                      navigate(`/clientes/${r.referredClientId}`)
                    }
                  >
                    <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0 font-semibold text-primary text-sm">
                      {r.referredName[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium text-slate-800 dark:text-slate-200",
                          r.referredClientId &&
                            "group-hover:text-primary group-hover:underline",
                        )}
                      >
                        {r.referredName}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {formatPhone(r.referredPhone)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Referrer */}
                <div className="min-w-0">
                  <p className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Indicador</p>
                  <div
                    className="flex items-center gap-2 min-w-0 cursor-pointer group"
                    onClick={() => navigate(`/clientes/${r.referrerId}`)}
                  >
                    <div className="h-7 w-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 font-medium text-slate-500 dark:text-slate-400 text-xs">
                      {r.referrerName[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-primary group-hover:underline">
                        {r.referrerName}
                      </p>
                      {(r.benefit1DeliveredAt || r.benefit2DeliveredAt) && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {r.benefit1DeliveredAt && (
                            <span
                              title={`Benefício 1 entregue ao indicador em ${format(new Date(r.benefit1DeliveredAt), "dd/MM/yyyy", { locale: ptBR })}`}
                              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20 cursor-default"
                            >
                              <Gift className="h-2.5 w-2.5" /> B1
                            </span>
                          )}
                          {r.benefit2DeliveredAt && (
                            <span
                              title={`Benefício 2 entregue ao indicador em ${format(new Date(r.benefit2DeliveredAt), "dd/MM/yyyy", { locale: ptBR })}`}
                              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 cursor-default"
                            >
                              <Trophy className="h-2.5 w-2.5" /> B2
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Responsável */}
                <div className="min-w-0">
                  <p className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Responsável</p>
                  {r.referrerResponsavelName ? (
                    <span className="text-sm text-slate-600 dark:text-slate-400 block">
                      {r.referrerResponsavelName}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-600 italic">
                      Sem responsável
                    </span>
                  )}
                </div>

                {/* Status */}
                <div>
                  <p className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Status</p>
                  {r.hasPurchased ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs gap-1">
                      <ShoppingBag className="h-3 w-3" /> Comprou
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-slate-400 text-xs gap-1"
                    >
                      <Clock className="h-3 w-3" /> Ainda não comprou
                    </Badge>
                  )}
                  {r.messageSent && (
                    <div className="flex items-center gap-1 mt-1">
                      <MessageSquare className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Msg enviada
                      </span>
                    </div>
                  )}
                </div>

                {/* Date */}
                <div>
                  <p className="sm:hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Data</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {format(new Date(r.createdAt), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                  {r.hasPurchased && r.purchasedAt && (
                    <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-0.5">
                      Compra:{" "}
                      {format(new Date(r.purchasedAt), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
