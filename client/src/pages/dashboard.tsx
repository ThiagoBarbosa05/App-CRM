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
  TrendingUp,
  Users,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

import EventsDashboard from "@/components/events-dashboard";
import { ClientDebt, DashboardStats } from "@/types/dashboard";
import { DashboardStatsCards } from "@/components/dashboard/dashboard-stats-cards";
import { DashboardDebtsTab } from "@/components/dashboard/dashboard-debts-tab";
import { DashboardSummaryTab } from "@/components/dashboard/dashboard-summary-tab";
import {
  AggregateView,
  IndividualSellerView,
} from "@/pages/seller-dashboard";

// ---------------------------------------------------------------------------

interface UserOption {
  id: string;
  name: string;
  role: string;
  isActive: string;
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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });

  const startDate = useMemo(
    () =>
      dateRange?.from
        ? format(dateRange.from, "yyyy-MM-dd")
        : format(startOfMonth(new Date()), "yyyy-MM-dd"),
    [dateRange?.from],
  );
  const endDate = useMemo(
    () => (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : startDate),
    [dateRange?.to, startDate],
  );

  // ── Seletor de vendedor (admin) ────────────────────────────────────────────
  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");

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
      const url =
        isAdmin
          ? `/api/client-debts`
          : `/api/client-debts?responsibleId=${user?.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch client debts");
      return res.json();
    },
    enabled: !!user,
  });

  // ── Query de aniversários (usada no resumo de cobranças) ──────────────────
  const { data: upcomingBirthdays = [] } = useQuery({
    queryKey: [`/api/birthdays/upcoming`, user?.id, user?.role],
    queryFn: async () => {
      const url =
        isAdmin
          ? `/api/birthdays/upcoming`
          : `/api/birthdays/upcoming?responsibleId=${user?.id}`;
      const res = await fetch(url, {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch birthdays");
      const data = await res.json();
      return data
        .map((client: any) => {
          if (!client.nextBirthday) return { ...client, daysUntil: 365 };
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const next = new Date(client.nextBirthday);
          next.setHours(0, 0, 0, 0);
          const daysUntil = Math.max(
            0,
            Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          );
          return { ...client, daysUntil };
        })
        .sort((a: any, b: any) => a.daysUntil - b.daysUntil)
        .slice(0, 15);
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

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          {/* Date range picker */}
          <div className="flex flex-col items-start gap-1">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium h-9 px-3"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <span>
                        {format(dateRange.from, "dd/MM/yy")} —{" "}
                        {format(dateRange.to, "dd/MM/yy")}
                      </span>
                    ) : (
                      format(dateRange.from, "dd/MM/yy")
                    )
                  ) : (
                    <span>Selecione um período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    if (range?.from && range?.to) setIsCalendarOpen(false);
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
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
        </div>
      </div>

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
              upcomingBirthdays={upcomingBirthdays}
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
