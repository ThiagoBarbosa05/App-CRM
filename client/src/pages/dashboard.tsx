import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CreditCard,
  Package,
  Percent,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
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
}: {
  startDate: string;
  endDate: string;
}) {
  const { data, isLoading, isFetching } = useCohortAnalysis(startDate, endDate);
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
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }, [datePreset, customRange]);

  const startDate = useMemo(
    () => format(dateRange.from!, "yyyy-MM-dd"),
    [dateRange.from],
  );
  const endDate = useMemo(
    () => format(dateRange.to!, "yyyy-MM-dd"),
    [dateRange.to],
  );

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
      <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 px-4 sm:px-6 py-4 rounded-lg shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <TrendingUp className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Dashboard
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              Visão geral de performance e atividades
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start gap-3 shrink-0">
          {/* Filtro de período */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 gap-0.5">
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
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                    datePreset === value
                      ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => setDatePreset("periodo")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                      datePreset === "periodo"
                        ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800"
                        : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
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
            <p className="text-xs text-slate-400">
              Afeta gráficos e métricas do período
            </p>
          </div>

          {/* Seletor de vendedor — admin/gerente */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <Select
                value={selectedSellerId}
                onValueChange={setSelectedSellerId}
              >
                <SelectTrigger className="w-52 rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium">
                  <SelectValue placeholder="Selecionar vendedor" />
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
              className="gap-2 bg-violet-600 hover:bg-violet-700 rounded-xl h-9 px-4 text-sm font-bold shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar CSV
            </Button>
          )}
        </div>
      </div>

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
        <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl shadow-md">
          <TabsList className="grid w-full grid-cols-3 gap-2 sm:gap-1 rounded-lg bg-slate-50 dark:bg-slate-900">
            <TabsTrigger
              value="desempenho"
              className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 dark:data-[state=active]:border-blue-800
                hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 border border-transparent"
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="truncate">Desempenho</span>
            </TabsTrigger>

            <TabsTrigger
              value="cobrancas"
              className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-red-200 dark:data-[state=active]:border-red-800
                hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 border border-transparent"
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="truncate">Cobranças</span>
            </TabsTrigger>

            <TabsTrigger
              value="eventos"
              className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-800
                hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 border border-transparent"
            >
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="truncate">Eventos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Aba Desempenho ─────────────────────────────────────────────────── */}
        <TabsContent value="desempenho" className="m-0 outline-none">
          <Tabs defaultValue="vendas" className="space-y-4">
            <div className="border-b border-gray-200 dark:border-slate-800 mb-4 overflow-x-auto no-scrollbar">
              <TabsList className="flex w-max min-w-full h-12 items-center justify-start rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="vendas"
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
                >
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Vendas</span>
                </TabsTrigger>

                <TabsTrigger
                  value="cohort"
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 data-[state=active]:border-green-600 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
                >
                  <Percent className="h-4 w-4 shrink-0" />
                  <span className="truncate">Cohort</span>
                </TabsTrigger>

                <TabsTrigger
                  value="pedidos"
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 data-[state=active]:border-orange-600 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
                >
                  <Package className="h-4 w-4 shrink-0" />
                  <span className="truncate">Pedidos</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="vendas" className="m-0 outline-none">
              {showAggregateView ? (
                <AggregateView startDate={startDate} endDate={endDate} />
              ) : (
                user && (
                  <IndividualSellerView
                    sellerId={resolvedSellerId || user.id}
                    isOwnView={!isAdmin || selectedSellerId === user.id}
                    startDate={startDate}
                    endDate={endDate}
                  />
                )
              )}
            </TabsContent>

            <TabsContent value="cohort" className="m-0 outline-none">
              <CohortAnalysisContent startDate={startDate} endDate={endDate} />
            </TabsContent>

            <TabsContent value="pedidos" className="m-0 outline-none">
              <OrdersSection startDate={startDate} endDate={endDate} />
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
      </Tabs>
    </div>
  );
}
