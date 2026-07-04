import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  PillTabsList,
  PillTabsTrigger,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "@/components/app-tabs";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  BarChart3,
  Calendar,
  CalendarIcon,
  ClipboardList,
  CreditCard,
  Package,
  Percent,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

import EventsDashboard from "@/components/events-dashboard";
import { ClientDebt, DashboardStats } from "@/types/dashboard";
import { DashboardStatsCards } from "@/components/dashboard/dashboard-stats-cards";
import { DashboardDebtsTab } from "@/components/dashboard/dashboard-debts-tab";
import { DashboardSummaryTab } from "@/components/dashboard/dashboard-summary-tab";
import { AggregateView } from "@/components/seller-dashboard/aggregate-view";
import { IndividualSellerView } from "@/components/seller-dashboard/individual-seller-view";
import { OrdersSection } from "@/components/seller-dashboard/orders-section";
import { ConnectCsvImportModal } from "@/components/connect-sales/connect-csv-import-modal";
import { CohortAnalysisTable } from "@/components/bling-sales/cohort-analysis-table";
import { useCohortAnalysis } from "@/hooks/use-bling-orders";
import { RegistrationQualityList } from "@/components/clients/registration-quality-list";

// ---------------------------------------------------------------------------

interface UserOption {
  id: string;
  name: string;
  role: string;
  isActive: string;
}

// ---------------------------------------------------------------------------

function CohortAnalysisContent({
  startDate,
  endDate,
  userId,
}: {
  startDate: string;
  endDate: string;
  userId?: string;
}) {
  const { data, isLoading, isFetching } = useCohortAnalysis(startDate, endDate, userId);
  return (
    <CohortAnalysisTable
      data={data}
      isLoading={isLoading}
      isFetching={isFetching}
      startDate={startDate}
      endDate={endDate}
    />
  );
}

// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "gerente" ||
    user?.role === "administrador";

  // ── Estado da aba ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("desempenho");

  // ── Date range ────────────────────────────────────────────────────────────
  type DatePreset = "hoje" | "este-mes" | "mes-passado" | "periodo";
  const [datePreset, setDatePreset] = useState<DatePreset>("este-mes");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const dateRange = useMemo<DateRange>(() => {
    const now = new Date();
    if (datePreset === "hoje")
      return { from: startOfDay(now), to: endOfDay(now) };
    if (datePreset === "mes-passado") {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    if (datePreset === "periodo" && customRange?.from)
      return { from: customRange.from, to: customRange.to ?? customRange.from };
    return { from: startOfMonth(now), to: endOfDay(now) };
  }, [datePreset, customRange]);

  const startDate = useMemo(
    () => format(dateRange.from!, "yyyy-MM-dd"),
    [dateRange.from],
  );
  const endDate = useMemo(
    () => format(dateRange.to!, "yyyy-MM-dd"),
    [dateRange.to],
  );

  // Quando o filtro é "Este mês", compara contra o mesmo intervalo do mês anterior
  // (ex: 01/05–13/05 compara com 01/04–13/04, não com 18/04–30/04)
  const { prevStartDate, prevEndDate } = useMemo(() => {
    if (datePreset !== "este-mes") return { prevStartDate: undefined, prevEndDate: undefined };
    return {
      prevStartDate: format(subMonths(dateRange.from!, 1), "yyyy-MM-dd"),
      prevEndDate: format(subMonths(dateRange.to!, 1), "yyyy-MM-dd"),
    };
  }, [datePreset, dateRange.from, dateRange.to]);

  // ── Seletor de vendedor (admin) ────────────────────────────────────────────
  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");
  const [connectImportOpen, setConnectImportOpen] = useState(false);

  const { data: usersList = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
    select: (users) =>
      users
        .filter((u) => u.isActive === "true")
        .sort((a, b) => a.name.localeCompare(b.name)),
  });

  // ── Queries de cobranças ───────────────────────────────────────────────────
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: [`/api/dashboard/stats/${user?.id}`],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats/${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: clientDebts = [] } = useQuery<ClientDebt[]>({
    queryKey: [`/api/client-debts`, user?.id, user?.role],
    queryFn: async () => {
      const url = isAdmin
        ? `/api/client-debts`
        : `/api/client-debts?responsibleId=${user?.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch client debts");
      return res.json();
    },
    enabled: !!user,
  });

  // ── Derivados ─────────────────────────────────────────────────────────────
  const pendingDebts = clientDebts.filter((d) => d.status === "pending");
  const overdueDebts = clientDebts.filter(
    (d) => d.status === "pending" && new Date(d.dueDate) < new Date(),
  );

  const showAggregateView = isAdmin && selectedSellerId === "all";

  const resolvedSellerId = useMemo(() => {
    if (!isAdmin) return user?.id ?? "";
    return selectedSellerId === "all" ? "" : selectedSellerId;
  }, [isAdmin, selectedSellerId, user?.id]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* Header ──────────────────────────────────────────────────────────── */}
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={TrendingUp}
            color="text-primary"
            bgColor="bg-accent"
          />
          <PageHeader.Text>
            <PageHeader.Title>Dashboard</PageHeader.Title>
            <PageHeader.Description>
              Visão geral de performance e atividades
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>

        <PageHeader.Actions className="flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filtro de período */}
          <div className="overflow-x-auto max-w-full">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm min-w-max">
              {(
                [
                  { value: "hoje", label: "Hoje" },
                  { value: "este-mes", label: "Este mês" },
                  { value: "mes-passado", label: "Mês passado" },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDatePreset(value)}
                  className={`inline-flex items-center whitespace-nowrap px-3.5 py-2 rounded-lg text-sm transition-all duration-200 outline-none border ${
                    datePreset === value
                      ? "font-semibold text-primary bg-accent border-border"
                      : "font-medium text-muted-foreground border-transparent hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {label}
                </button>
              ))}

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => setDatePreset("periodo")}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-lg text-sm transition-all duration-200 outline-none border ${
                      datePreset === "periodo"
                        ? "font-semibold text-primary bg-accent border-border"
                        : "font-medium text-muted-foreground border-transparent hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {datePreset === "periodo" && customRange?.from ? (
                      <span>
                        {format(customRange.from, "dd/MM/yy")}
                        {customRange.to &&
                          customRange.to !== customRange.from &&
                          ` — ${format(customRange.to, "dd/MM/yy")}`}
                      </span>
                    ) : (
                      "Período"
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={customRange?.from ?? new Date()}
                    selected={customRange}
                    onSelect={(range) => {
                      setCustomRange(range);
                      if (range?.from && range?.to) setIsCalendarOpen(false);
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Seletor de vendedor */}
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Select
                value={selectedSellerId}
                onValueChange={setSelectedSellerId}
              >
                <SelectTrigger className="w-auto min-w-[140px] rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium [&>span]:line-clamp-none [&>span]:whitespace-nowrap">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-semibold">
                    Todos os vendedores
                  </SelectItem>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Importar CSV */}
          {user?.role === "admin" && (
            <Button
              onClick={() => setConnectImportOpen(true)}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 px-4 text-sm font-bold shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar CSV
            </Button>
          )}
        </PageHeader.Actions>
      </PageHeader>

      <ConnectCsvImportModal
        open={connectImportOpen}
        onOpenChange={setConnectImportOpen}
      />

      {/* Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <PillTabsList className="w-full">
          <PillTabsTrigger
            value="desempenho"
            color="blue"
            className="flex-1 justify-center"
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Desempenho</span>
          </PillTabsTrigger>

          <PillTabsTrigger
            value="cobrancas"
            color="red"
            className="flex-1 justify-center"
          >
            <CreditCard className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Cobranças</span>
          </PillTabsTrigger>

          <PillTabsTrigger
            value="eventos"
            color="purple"
            className="flex-1 justify-center"
          >
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Eventos</span>
          </PillTabsTrigger>

          <PillTabsTrigger
            value="cadastro-incompleto"
            color="amber"
            className="flex-1 justify-center"
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Cadastro Incompleto</span>
          </PillTabsTrigger>
        </PillTabsList>

        {/* Aba Desempenho ─────────────────────────────────────────────────── */}
        <TabsContent value="desempenho" className="m-0 outline-none">
          <Tabs defaultValue="vendas" className="space-y-4">
            <UnderlineTabsList>
              <UnderlineTabsTrigger value="vendas" color="blue">
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>Vendas</span>
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="cohort" color="green">
                <Percent className="h-4 w-4 shrink-0" />
                <span>Cohort</span>
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="pedidos" color="orange">
                <Package className="h-4 w-4 shrink-0" />
                <span>Pedidos</span>
              </UnderlineTabsTrigger>
            </UnderlineTabsList>

            <TabsContent value="vendas" className="m-0 outline-none">
              {showAggregateView ? (
                <AggregateView
                  startDate={startDate}
                  endDate={endDate}
                  prevStartDate={prevStartDate}
                  prevEndDate={prevEndDate}
                />
              ) : (
                user && (
                  <IndividualSellerView
                    sellerId={resolvedSellerId || user.id}
                    isOwnView={!isAdmin || selectedSellerId === user.id}
                    startDate={startDate}
                    endDate={endDate}
                    prevStartDate={prevStartDate}
                    prevEndDate={prevEndDate}
                  />
                )
              )}
            </TabsContent>

            <TabsContent value="cohort" className="m-0 outline-none">
              <CohortAnalysisContent startDate={startDate} endDate={endDate} userId={resolvedSellerId || undefined} />
            </TabsContent>

            <TabsContent value="pedidos" className="m-0 outline-none">
              <OrdersSection startDate={startDate} endDate={endDate} lockedUserId={resolvedSellerId || undefined} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Aba Cobranças ──────────────────────────────────────────────────── */}
        <TabsContent value="cobrancas" className="m-0 outline-none space-y-6">
          <DashboardStatsCards
            stats={stats}
            pendingDebts={pendingDebts}
            overdueDebts={overdueDebts}
          />
          <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
            <DashboardDebtsTab
              pendingDebts={pendingDebts}
              setSelectedClient={(client) => navigate(`/clientes/${client.id}`)}
            />
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
            <DashboardSummaryTab
              clientDebts={clientDebts}
              pendingDebts={pendingDebts}
              overdueDebts={overdueDebts}
            />
          </div>
        </TabsContent>

        {/* Aba Eventos ────────────────────────────────────────────────────── */}
        <TabsContent value="eventos" className="m-0 outline-none space-y-4">
          <EventsDashboard />
        </TabsContent>

        {/* Aba Cadastro Incompleto ───────────────────────────────────────── */}
        <TabsContent
          value="cadastro-incompleto"
          className="m-0 outline-none space-y-4"
        >
          <RegistrationQualityList responsavelId={resolvedSellerId || undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
