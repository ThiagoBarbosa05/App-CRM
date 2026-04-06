import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { WeeklyResultModal } from "@/components/admin-goals/modals/weekly-result-modal";

// Components
import { GoalsHeader } from "@/components/goals/goals-header";
import { SalesGoalsGrid } from "@/components/goals/sales-goals-grid";
import { TelemarketingGoalsGrid } from "@/components/goals/telemarketing-goals-grid";
import { ActivityGoalsSections } from "@/components/goals/activity-goals-sections";

export default function Metas() {
  const { user } = useAuth();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedGoalForResults, setSelectedGoalForResults] = useState<any | null>(null);
  const [selectedResultForEdit, setSelectedResultForEdit] = useState<any | null>(null);

  // Queries
  const { data: userGoals = [], isLoading: isUserGoalsLoading } = useQuery<
    any[]
  >({
    queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
  });

  const { data: registrationStats = [] } = useQuery<any[]>({
    queryKey: ["/api/user-registration-stats"],
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

  // Helpers
  const calculatePercentage = (achieved: number, goal: number) => {
    if (goal === 0) return 0;
    return Math.min((achieved / goal) * 100, 100);
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

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value));
  };

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

  // Filter Logic
  const isManager =
    user?.role === "admin" ||
    user?.role === "gerente" ||
    user?.role === "administrador";

  const filteredGoals = useMemo(
    () =>
      isManager
        ? userGoals
        : userGoals.filter((goal) => goal.userId === user?.id),
    [userGoals, isManager, user?.id],
  );

  const filteredTelemarketingGoals = useMemo(
    () =>
      isManager
        ? telemarketingGoals
        : telemarketingGoals.filter((goal) => goal.userId === user?.id),
    [telemarketingGoals, isManager, user?.id],
  );

  const filteredClientRegistrationGoals = useMemo(
    () =>
      isManager
        ? clientRegistrationGoals
        : clientRegistrationGoals.filter((goal) => goal.userId === user?.id),
    [clientRegistrationGoals, isManager, user?.id],
  );

  const filteredMarkerGoals = useMemo(
    () =>
      isManager
        ? markerGoals
        : markerGoals.filter((goal) => goal.userId === user?.id),
    [markerGoals, isManager, user?.id],
  );

  const filteredInteractionGoals = useMemo(
    () =>
      isManager
        ? interactionGoals
        : interactionGoals.filter((goal) => goal.userId === user?.id),
    [interactionGoals, isManager, user?.id],
  );

  if (isUserGoalsLoading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
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

  return (
    <div className="space-y-8 pb-10">
      <GoalsHeader
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
        isAdmin={isManager}
      />

      {user?.role === "vendedor" && (
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
            Os resultados semanais são cadastrados pelos gerentes e
            administradores do sistema.
          </p>
        </div>
      )}

      <SalesGoalsGrid
        goals={filteredGoals}
        formatCurrency={formatCurrency}
        calculatePercentage={calculatePercentage}
        getTotalAchieved={getTotalAchieved}
        isAdmin={isManager}
        onAddResult={(goal) => {
          setSelectedGoalForResults(goal);
          setSelectedResultForEdit(null);
          setIsResultModalOpen(true);
        }}
        onEditResult={(goal, result) => {
          setSelectedGoalForResults(goal);
          setSelectedResultForEdit(result);
          setIsResultModalOpen(true);
        }}
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

      <TelemarketingGoalsGrid
        goals={filteredTelemarketingGoals}
        stats={telemarketingStats}
        calculatePercentage={calculatePercentage}
      />

      <ActivityGoalsSections
        registrationGoals={filteredClientRegistrationGoals}
        registrationStats={clientRegistrationStats}
        markerGoals={filteredMarkerGoals}
        markerStats={markerStats}
        interactionGoals={filteredInteractionGoals}
        interactionStats={interactionStats}
        calculatePercentage={calculatePercentage}
        getInteractionTypeLabel={getInteractionTypeLabel}
      />
    </div>
  );
}
