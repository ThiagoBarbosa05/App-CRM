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
  ClipboardList,
  CreditCard,
  Percent,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  DateRangeFilter,
  useDateRangeFilter,
} from "@/components/date-range-filter";

import EventsDashboard from "@/components/events-dashboard";
import { ClientDebt, DashboardStats } from "@/types/dashboard";
import { DashboardStatsCards } from "@/components/dashboard/dashboard-stats-cards";
import { DashboardDebtsTab } from "@/components/dashboard/dashboard-debts-tab";
import { DashboardSummaryTab } from "@/components/dashboard/dashboard-summary-tab";
import { AggregateView } from "@/components/seller-dashboard/aggregate-view";
import { IndividualSellerView } from "@/components/seller-dashboard/individual-seller-view";
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
      userId={userId}
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
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "desempenho";
  });

  // ── Date range ────────────────────────────────────────────────────────────
  const { startDate, endDate, prevStartDate, prevEndDate, dateFilterProps } =
    useDateRangeFilter();

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
          <DateRangeFilter {...dateFilterProps} />

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
