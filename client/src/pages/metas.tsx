import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  BarChart3,
  DollarSign,
  Package,
  Plus,
  Target,
  Users,
  Phone,
  MessageSquare,
  Wine,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PillTabsList,
  PillTabsTrigger,
  type TabColor,
} from "@/components/app-tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { PageHeader } from "@/components/page-header";

// Componentes de visualização
import { SalesGoalsGrid } from "@/components/goals/sales-goals-grid";
import { ProductGoalsTab } from "@/components/admin-goals/tabs/product-goals-tab";
import { TelemarketingGoalsGrid } from "@/components/goals/telemarketing-goals-grid";
import { ActivityGoalsSections } from "@/components/goals/activity-goals-sections";
import { ClientRegistrationGoalsTab } from "@/components/admin-goals/tabs/registration-goals-tab";

// Modais de criação/edição (admin)
import { SalesGoalModal } from "@/components/admin-goals/modals/sales-goal-modal";
import { WeeklyResultModal } from "@/components/admin-goals/modals/weekly-result-modal";
import { TelemarketingGoalModal } from "@/components/admin-goals/modals/telemarketing-goal-modal";
import { ClientRegistrationGoalModal } from "@/components/admin-goals/modals/registration-goal-modal";
import { MarkerGoalModal } from "@/components/admin-goals/modals/marker-goal-modal";
import { InteractionGoalModal } from "@/components/admin-goals/modals/interaction-goal-modal";
import { ProductGoalModal } from "@/components/admin-goals/modals/product-goal-modal";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

export default function Metas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isManager =
    user?.role === "admin" ||
    user?.role === "gerente" ||
    user?.role === "administrador";

  // Período selecionado
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Filtro de vendedor (admin)
  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");

  // Tab ativa
  const [activeTab, setActiveTab] = useState("sales");

  // Estados dos modais
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [editingSalesGoal, setEditingSalesGoal] = useState<any>(null);

  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedGoalForResults, setSelectedGoalForResults] =
    useState<any>(null);
  const [selectedResultForEdit, setSelectedResultForEdit] = useState<any>(null);

  const [isTelemarketingModalOpen, setIsTelemarketingModalOpen] =
    useState(false);
  const [editingTelemarketingGoal, setEditingTelemarketingGoal] =
    useState<any>(null);

  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [editingRegistrationGoal, setEditingRegistrationGoal] =
    useState<any>(null);

  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
  const [editingMarkerGoal, setEditingMarkerGoal] = useState<any>(null);

  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [editingInteractionGoal, setEditingInteractionGoal] =
    useState<any>(null);

  const [isProductGoalModalOpen, setIsProductGoalModalOpen] = useState(false);
  const [editingProductSeller, setEditingProductSeller] = useState<{ userId: string; userName: string } | null>(null);

  // -------------------------------------------------------------------------
  // Queries.
  // -------------------------------------------------------------------------

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: isManager,
  });

  const { data: availableMarkers = [] } = useQuery<any[]>({
    queryKey: ["/api/tags/markers"],
    enabled: isManager,
  });

  const { data: userGoals = [], isLoading: isUserGoalsLoading } = useQuery<
    any[]
  >({
    queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
  });

  const { data: productGoalsData = [], isLoading: isProductGoalsLoading } = useQuery<any[]>({
    queryKey: [`/api/product-goals/${selectedMonth}/${selectedYear}`],
  });

  const { data: wineryGoalsData = [] } = useQuery<any[]>({
    queryKey: ["/api/winery-goals"],
  });

  const { data: categoryGoalsData = [] } = useQuery<any[]>({
    queryKey: ["/api/category-goals"],
  });

  const { data: telemarketingGoals = [] } = useQuery<any[]>({
    queryKey: [`/api/telemarketing-goals/${selectedMonth}/${selectedYear}`],
  });

  const { data: telemarketingStats = [] } = useQuery<any[]>({
    queryKey: [`/api/telemarketing-stats/${selectedMonth}/${selectedYear}`],
  });

  const { data: clientRegistrationGoals = [] } = useQuery<any[]>({
    queryKey: [
      `/api/client-registration-goals/${selectedMonth}/${selectedYear}`,
    ],
  });

  const { data: clientRegistrationStats = [] } = useQuery<any[]>({
    queryKey: [
      `/api/client-registration-stats/${selectedMonth}/${selectedYear}`,
    ],
    staleTime: 0,
  });

  const { data: markerGoals = [] } = useQuery<any[]>({
    queryKey: [`/api/marker-goals/${selectedMonth}/${selectedYear}`],
  });

  const { data: markerStats = [] } = useQuery<any[]>({
    queryKey: [`/api/marker-stats/${selectedMonth}/${selectedYear}`],
  });

  const { data: interactionGoals = [] } = useQuery<any[]>({
    queryKey: [`/api/interaction-goals/${selectedMonth}/${selectedYear}`],
  });

  const { data: interactionStats = [] } = useQuery<any[]>({
    queryKey: [`/api/interaction-stats/${selectedMonth}/${selectedYear}`],
  });

  // Vendas reais Bling/Connect
  const startDate = format(
    startOfMonth(new Date(selectedYear, selectedMonth - 1, 1)),
    "yyyy-MM-dd",
  );
  const endDate = format(
    endOfMonth(new Date(selectedYear, selectedMonth - 1, 1)),
    "yyyy-MM-dd",
  );

  const { data: topSellers = [] } = useQuery<any[]>({
    queryKey: ["unified-top-sellers", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, limit: "100" });
      const res = await fetch(
        `/api/unified-orders/statistics/top-sellers?${params}`,
      );
      if (!res.ok) return [];
      const j = await res.json();
      return j.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // -------------------------------------------------------------------------
  // Mutations (admin)
  // -------------------------------------------------------------------------

  const deleteRegistrationGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest("DELETE", `/api/client-registration-goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/client-registration-goals/${selectedMonth}/${selectedYear}`,
        ],
      });
      toast({
        title: "Meta excluída",
        description: "Meta de cadastros excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSalesGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const response = await fetch(`/api/user-goals/${goalId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Falha ao excluir meta");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/user-goals-with-results/${selectedMonth}/${selectedYear}`,
        ],
      });
      toast({
        title: "Meta excluída",
        description: "Meta de vendas excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // -------------------------------------------------------------------------
  // Lógica de filtro
  // -------------------------------------------------------------------------

  const filterGoals = (items: any[]) => {
    if (!isManager) return items.filter((i) => i.userId === user?.id);
    if (selectedSellerId !== "all")
      return items.filter((i) => i.userId === selectedSellerId);
    return items;
  };

  // -------------------------------------------------------------------------
  // Stats (admin)
  // -------------------------------------------------------------------------

  const stats = useMemo(
    () => ({
      totalUsers: users.length,
      metasDefinidas: userGoals.length,
      metaTotal: userGoals.reduce((sum, g) => sum + Number(g.salesGoal), 0),
      ticketMedio:
        userGoals.length > 0
          ? userGoals.reduce((sum, g) => sum + Number(g.averageTicket), 0) /
            userGoals.length
          : 0,
    }),
    [userGoals, users],
  );

  const usersWithoutGoals = useMemo(
    () => users.filter((u) => !userGoals.find((g) => g.userId === u.id)),
    [users, userGoals],
  );

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const calculatePercentage = (achieved: number, goal: number) => {
    if (goal === 0) return 0;
    return (achieved / goal) * 100;
  };

  const getTotalAchieved = (
    weeklyResults: any[],
    field: "salesAchieved" | "ticketAchieved" | "itemsAchieved",
  ) => {
    if (!weeklyResults || !Array.isArray(weeklyResults)) return 0;
    return weeklyResults.reduce((sum, result) => {
      if (field === "itemsAchieved") return sum + result[field];
      return sum + Number(result[field]);
    }, 0);
  };

  const formatCurrency = (value: string | number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value));

  const getInteractionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      telemarketing: "Ligação",
      email: "E-mail",
      meeting: "Reunião",
      whatsapp: "WhatsApp",
      visit: "Visita",
      note: "Anotação",
      other: "Outro",
    };
    return types[type] || type;
  };

  // -------------------------------------------------------------------------
  // Handlers de modais
  // -------------------------------------------------------------------------

  const handleNewGoal = () => {
    switch (activeTab) {
      case "sales":
        setEditingSalesGoal(null);
        setIsSalesModalOpen(true);
        break;
      case "products":
        setEditingProductSeller(null);
        setIsProductGoalModalOpen(true);
        break;
      case "telemarketing":
        setEditingTelemarketingGoal(null);
        setIsTelemarketingModalOpen(true);
        break;
      case "registration":
        setEditingRegistrationGoal(null);
        setIsRegistrationModalOpen(true);
        break;
      case "markers":
        setEditingMarkerGoal(null);
        setIsMarkerModalOpen(true);
        break;
      case "interactions":
        setEditingInteractionGoal(null);
        setIsInteractionModalOpen(true);
        break;
    }
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (isUserGoalsLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl"
            />
          ))}
        </div>
      </div>
    );
  }

  const TABS: {
    id: string;
    label: string;
    icon: React.ElementType;
    color: TabColor;
  }[] = [
    { id: "sales", label: "Vendas", icon: Target, color: "blue" },
    { id: "products", label: "Produtos", icon: Wine, color: "purple" },
    { id: "telemarketing", label: "Ligações", icon: Phone, color: "green" },
    { id: "registration", label: "Cadastros", icon: Users, color: "indigo" },
    { id: "markers", label: "Marcadores", icon: Package, color: "amber" },
    {
      id: "interactions",
      label: "Interações",
      icon: MessageSquare,
      color: "purple",
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* Header unificado */}
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={Target}
            color="text-primary"
            bgColor="bg-accent"
          />
          <PageHeader.Text>
            <PageHeader.Title>Análise de Metas</PageHeader.Title>
            <PageHeader.Description>
              Acompanhe o progresso das metas da equipe
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>

        <PageHeader.Actions className="flex-wrap items-center gap-2 w-full md:w-auto">
          {isManager && users.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Select
                value={selectedSellerId}
                onValueChange={setSelectedSellerId}
              >
                <SelectTrigger className="w-auto min-w-[130px] rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium [&>span]:line-clamp-none [&>span]:whitespace-nowrap">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-semibold">
                    Todos os vendedores
                  </SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(Number(v))}
          >
            <SelectTrigger className="w-auto min-w-[120px] rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium [&>span]:line-clamp-none [&>span]:whitespace-nowrap">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <SelectItem key={month} value={String(month)}>
                  {new Date(0, month - 1).toLocaleDateString("pt-BR", {
                    month: "long",
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-24 rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {Array.from(
                { length: 5 },
                (_, i) => new Date().getFullYear() - 2 + i,
              ).map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isManager && (
            <Button
              onClick={handleNewGoal}
              className="h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm gap-2 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Meta
            </Button>
          )}
        </PageHeader.Actions>
      </PageHeader>

      {/* Aviso para vendedor */}
      {!isManager && (
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
            Os resultados mensais são cadastrados pelos gerentes e
            administradores do sistema.
          </p>
        </div>
      )}

      {/* Barra de stats — admin/gerente */}
      {isManager && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Usuários",
              value: stats.totalUsers,
              icon: Users,
              color: "blue",
              sub: "cadastrados",
            },
            {
              label: "Metas Definidas",
              value: stats.metasDefinidas,
              icon: Target,
              color: "emerald",
              sub: "no período",
            },
            {
              label: "Meta Total",
              value: formatCurrency(stats.metaTotal),
              icon: DollarSign,
              color: "indigo",
              sub: "soma das metas",
            },
            {
              label: "Ticket Médio",
              value: formatCurrency(stats.ticketMedio),
              icon: Package,
              color: "amber",
              sub: "média do período",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {stat.label}
                  </CardTitle>
                  <div
                    className={`p-2 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400`}
                  >
                    <stat.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tight">
                    {stat.sub}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs de tipos de meta */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <div className="overflow-x-auto w-full pb-0.5">
          <PillTabsList className="min-w-max">
            {TABS.map((tab) => (
              <PillTabsTrigger key={tab.id} value={tab.id} color={tab.color}>
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </PillTabsTrigger>
            ))}
          </PillTabsList>
        </div>

        {/* Vendas */}
        <TabsContent value="sales" className="m-0 outline-none">
          <SalesGoalsGrid
            goals={filterGoals(userGoals)}
            formatCurrency={formatCurrency}
            calculatePercentage={calculatePercentage}
            getTotalAchieved={getTotalAchieved}
            isAdmin={isManager}
            topSellersData={topSellers}
            onAddResult={
              isManager
                ? (goal) => {
                    setSelectedGoalForResults(goal);
                    setSelectedResultForEdit(null);
                    setIsResultModalOpen(true);
                  }
                : undefined
            }
            onEditResult={
              isManager
                ? (goal, result) => {
                    setSelectedGoalForResults(goal);
                    setSelectedResultForEdit(result);
                    setIsResultModalOpen(true);
                  }
                : undefined
            }
            onEdit={
              isManager
                ? (goal) => {
                    setEditingSalesGoal(goal);
                    setIsSalesModalOpen(true);
                  }
                : undefined
            }
            onDelete={
              isManager
                ? (goalId) => deleteSalesGoalMutation.mutate(goalId)
                : undefined
            }
          />
        </TabsContent>

        {/* Produtos */}
        <TabsContent value="products" className="m-0 outline-none">
          <ProductGoalsTab
            productGoals={productGoalsData}
            wineryGoals={wineryGoalsData}
            categoryGoals={categoryGoalsData}
            sellers={users}
            isLoading={isProductGoalsLoading}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onManage={
              isManager
                ? (userId, userName) => { setEditingProductSeller({ userId, userName }); setIsProductGoalModalOpen(true); }
                : () => {}
            }
            isAdmin={isManager}
          />
        </TabsContent>

        {/* Ligações */}
        <TabsContent value="telemarketing" className="m-0 outline-none">
          <TelemarketingGoalsGrid
            goals={filterGoals(telemarketingGoals)}
            stats={telemarketingStats}
            calculatePercentage={calculatePercentage}
          />
          {filterGoals(telemarketingGoals).length === 0 && (
            <EmptyTabState message="Nenhuma meta de ligações para este período." />
          )}
        </TabsContent>

        {/* Cadastros */}
        <TabsContent value="registration" className="m-0 outline-none">
          {filterGoals(clientRegistrationGoals).length > 0 || isManager ? (
            <ActivityGoalsSections
              registrationGoals={filterGoals(clientRegistrationGoals)}
              registrationStats={clientRegistrationStats}
              markerGoals={[]}
              markerStats={[]}
              interactionGoals={[]}
              interactionStats={[]}
              calculatePercentage={calculatePercentage}
              getInteractionTypeLabel={getInteractionTypeLabel}
              isAdmin={isManager}
              onNewRegistration={
                isManager
                  ? () => {
                      setEditingRegistrationGoal(null);
                      setIsRegistrationModalOpen(true);
                    }
                  : undefined
              }
              onEditRegistration={
                isManager
                  ? (goal) => {
                      setEditingRegistrationGoal(goal);
                      setIsRegistrationModalOpen(true);
                    }
                  : undefined
              }
              onDeleteRegistration={
                isManager
                  ? (goalId) => deleteRegistrationGoalMutation.mutate(goalId)
                  : undefined
              }
            />
          ) : (
            <EmptyTabState message="Nenhuma meta de cadastros para este período." />
          )}
        </TabsContent>

        <TabsContent value="markers" className="m-0 outline-none">
          {filterGoals(markerGoals).length > 0 ? (
            <ActivityGoalsSections
              registrationGoals={[]}
              registrationStats={[]}
              markerGoals={filterGoals(markerGoals)}
              markerStats={markerStats}
              interactionGoals={[]}
              interactionStats={[]}
              calculatePercentage={calculatePercentage}
              getInteractionTypeLabel={getInteractionTypeLabel}
            />
          ) : (
            <EmptyTabState message="Nenhuma meta de marcadores para este período." />
          )}
        </TabsContent>

        <TabsContent value="interactions" className="m-0 outline-none">
          {filterGoals(interactionGoals).length > 0 ? (
            <ActivityGoalsSections
              registrationGoals={[]}
              registrationStats={[]}
              markerGoals={[]}
              markerStats={[]}
              interactionGoals={filterGoals(interactionGoals)}
              interactionStats={interactionStats}
              calculatePercentage={calculatePercentage}
              getInteractionTypeLabel={getInteractionTypeLabel}
            />
          ) : (
            <EmptyTabState message="Nenhuma meta de interações para este período." />
          )}
        </TabsContent>
      </Tabs>

      {/* Modais — somente para admin/gerente */}
      {isManager && (
        <>
          <SalesGoalModal
            open={isSalesModalOpen}
            onOpenChange={setIsSalesModalOpen}
            editingGoal={editingSalesGoal}
            users={users}
            usersWithoutGoals={usersWithoutGoals}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />

          <WeeklyResultModal
            open={isResultModalOpen}
            onOpenChange={(open) => {
              setIsResultModalOpen(open);
              if (!open) setSelectedResultForEdit(null);
            }}
            selectedGoal={selectedGoalForResults}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            existingResult={selectedResultForEdit}
          />

          <TelemarketingGoalModal
            open={isTelemarketingModalOpen}
            onOpenChange={setIsTelemarketingModalOpen}
            editingGoal={editingTelemarketingGoal}
            users={users}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />

          <ClientRegistrationGoalModal
            open={isRegistrationModalOpen}
            onOpenChange={setIsRegistrationModalOpen}
            editingGoal={editingRegistrationGoal}
            users={users}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />

          <MarkerGoalModal
            open={isMarkerModalOpen}
            onOpenChange={setIsMarkerModalOpen}
            editingGoal={editingMarkerGoal}
            users={users}
            availableMarkers={availableMarkers}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />

          <InteractionGoalModal
            open={isInteractionModalOpen}
            onOpenChange={setIsInteractionModalOpen}
            editingGoal={editingInteractionGoal}
            users={users}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />

          <ProductGoalModal
            open={isProductGoalModalOpen}
            onOpenChange={setIsProductGoalModalOpen}
            editingSellerId={editingProductSeller?.userId ?? null}
            editingSellerName={editingProductSeller?.userName ?? null}
            existingGoals={productGoalsData}
            wineryGoals={wineryGoalsData}
            categoryGoals={categoryGoalsData}
            sellers={users}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </>
      )}
    </div>
  );
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
      <Target className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">{message}</p>
    </div>
  );
}
