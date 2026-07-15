import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Phone, Users, Package, MessageSquare, Wine } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// Modular Components
import { AdminGoalsHeader } from "@/components/admin-goals/admin-goals-header";
import { SalesGoalsTab } from "@/components/admin-goals/tabs/sales-goals-tab";
import { ProductGoalsTab } from "@/components/admin-goals/tabs/product-goals-tab";
import { TelemarketingGoalsTab } from "@/components/admin-goals/tabs/telemarketing-goals-tab";
import { ClientRegistrationGoalsTab } from "@/components/admin-goals/tabs/registration-goals-tab";
import { MarkerGoalsTab } from "@/components/admin-goals/tabs/marker-goals-tab";
import { InteractionGoalsTab } from "@/components/admin-goals/tabs/interaction-goals-tab";

// Modals
import { SalesGoalModal } from "@/components/admin-goals/modals/sales-goal-modal";
import { WeeklyResultModal } from "@/components/admin-goals/modals/weekly-result-modal";
import { TelemarketingGoalModal } from "@/components/admin-goals/modals/telemarketing-goal-modal";
import { ClientRegistrationGoalModal } from "@/components/admin-goals/modals/registration-goal-modal";
import { MarkerGoalModal } from "@/components/admin-goals/modals/marker-goal-modal";
import { InteractionGoalModal } from "@/components/admin-goals/modals/interaction-goal-modal";

export default function AdminGoals() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("sales");
  
  // Date selection state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Modal states
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [editingSalesGoal, setEditingSalesGoal] = useState<any | null>(null);
  
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedGoalForResults, setSelectedGoalForResults] = useState<any | null>(null);

  const [isTelemarketingModalOpen, setIsTelemarketingModalOpen] = useState(false);
  const [editingTelemarketingGoal, setEditingTelemarketingGoal] = useState<any | null>(null);

  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [editingRegistrationGoal, setEditingRegistrationGoal] = useState<any | null>(null);

  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
  const [editingMarkerGoal, setEditingMarkerGoal] = useState<any | null>(null);

  const [isInteractionGoalModalOpen, setIsInteractionGoalModalOpen] = useState(false);
  const [editingInteractionGoal, setEditingInteractionGoal] = useState<any | null>(null);

  // Queries (Needed for stats and passing data to some components)
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: userGoals = [], isLoading: isLoadingSales } = useQuery<any[]>({
    queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
  });

  const { data: availableMarkers = [] } = useQuery<any[]>({
    queryKey: ["/api/tags/markers"],
  });

  // Verification if user is admin or manager
  if (user?.role !== "admin" && user?.role !== "gerente") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <Card className="max-w-md border-0 shadow-2xl rounded-[2rem] overflow-hidden">
          <div className="h-2 bg-rose-500" />
          <CardHeader className="p-10 text-center">
            <div className="mx-auto w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-3xl flex items-center justify-center mb-6 ring-8 ring-rose-50/50 dark:ring-rose-900/10">
              <Target className="h-10 w-10 text-rose-500" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Acesso Restrito
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 font-medium mt-4 text-balance">
              Esta área é exclusiva para administradores e gerentes. Se você acredita que deveria ter acesso, entre em contato com o suporte.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Mutations
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteSalesGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const response = await fetch(`/api/user-goals/${goalId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Falha ao excluir meta");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`] });
      toast({ title: "Meta excluída", description: "Meta de vendas excluída com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  // Calculate Stats
  const stats = {
    totalUsers: users.length,
    metasDefinidas: userGoals.length,
    metaTotal: userGoals.reduce((sum, goal) => sum + Number(goal.salesGoal), 0),
    ticketMedio: userGoals.length > 0 
      ? (userGoals.reduce((sum, goal) => sum + Number(goal.averageTicket), 0) / userGoals.length) 
      : 0
  };

  const usersWithoutGoals = users.filter(u => !userGoals.find(g => g.userId === u.id));

  // Handlers for Modals
  const handleNewGoal = () => {
    switch (activeTab) {
      case "sales": setIsSalesModalOpen(true); setEditingSalesGoal(null); break;
      case "telemarketing": setIsTelemarketingModalOpen(true); setEditingTelemarketingGoal(null); break;
      case "products": setEditingSalesGoal(null); setIsSalesModalOpen(true); break;
      case "registration": setIsRegistrationModalOpen(true); setEditingRegistrationGoal(null); break;
      case "markers": setIsMarkerModalOpen(true); setEditingMarkerGoal(null); break;
      case "interactions": setIsInteractionGoalModalOpen(true); setEditingInteractionGoal(null); break;
    }
  };

  return (
    <main className="p-4 lg:p-10 bg-slate-50 dark:bg-[#020617] min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-10">
          
          <AdminGoalsHeader 
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            stats={stats}
            onNewGoal={handleNewGoal}
            disableNewGoal={activeTab === "sales" && usersWithoutGoals.length === 0}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="flex items-center justify-start gap-4 bg-transparent h-auto p-0 overflow-x-auto no-scrollbar">
              {[
                { id: "sales", label: "Vendas", icon: Target, color: "blue" },
                { id: "products", label: "Produtos", icon: Wine, color: "violet" },
                { id: "telemarketing", label: "Ligações", icon: Phone, color: "purple" },
                { id: "registration", label: "Cadastros", icon: Users, color: "emerald" },
                { id: "markers", label: "Marcadores", icon: Package, color: "amber" },
                { id: "interactions", label: "Interações", icon: MessageSquare, color: "indigo" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`group flex items-center gap-3 px-6 py-4 rounded-2xl border border-transparent transition-all duration-300
                    data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 
                    data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 
                    data-[state=active]:shadow-lg dark:data-[state=active]:shadow-blue-500/5 
                    hover:bg-white/50 dark:hover:bg-white/5`}
                >
                  <div className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-data-[state=active]:bg-blue-500/10 transition-colors`}>
                    <tab.icon className={`h-4 w-4 text-slate-500 group-data-[state=active]:text-blue-500`} />
                  </div>
                  <span className="text-sm font-bold tracking-tight text-slate-500 group-data-[state=active]:text-slate-900 dark:group-data-[state=active]:text-white">
                    {tab.label}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="sales" className="m-0 outline-none">
              <SalesGoalsTab 
                goals={userGoals}
                isLoading={isLoadingSales}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onEdit={(goal) => { setEditingSalesGoal(goal); setIsSalesModalOpen(true); }}
                onAddResult={(goal) => { setSelectedGoalForResults(goal); setIsResultModalOpen(true); }}
                onDelete={(goalId) => deleteSalesGoalMutation.mutate(goalId)}
                isAdmin={user.role === "admin" || user.role === "gerente"}
              />
            </TabsContent>

            <TabsContent value="products" className="m-0 outline-none">
              <ProductGoalsTab
                goals={userGoals}
                isLoading={isLoadingSales}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onEdit={(goal) => { setEditingSalesGoal(goal); setIsSalesModalOpen(true); }}
                isAdmin={user.role === "admin" || user.role === "gerente"}
              />
            </TabsContent>

            <TabsContent value="telemarketing" className="m-0 border-0 outline-none">
              <TelemarketingGoalsTab 
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onEdit={(goal) => { setEditingTelemarketingGoal(goal); setIsTelemarketingModalOpen(true); }}
                onNew={() => { setEditingTelemarketingGoal(null); setIsTelemarketingModalOpen(true); }}
                isAdmin={user.role === "admin" || user.role === "gerente"}
              />
            </TabsContent>

            <TabsContent value="registration" className="m-0 outline-none">
              <ClientRegistrationGoalsTab 
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onEdit={(goal) => { setEditingRegistrationGoal(goal); setIsRegistrationModalOpen(true); }}
                onNew={() => { setEditingRegistrationGoal(null); setIsRegistrationModalOpen(true); }}
                isAdmin={user.role === "admin" || user.role === "gerente"}
              />
            </TabsContent>

            <TabsContent value="markers" className="m-0 outline-none">
              <MarkerGoalsTab 
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onEdit={(goal) => { setEditingMarkerGoal(goal); setIsMarkerModalOpen(true); }}
                onNew={() => { setEditingMarkerGoal(null); setIsMarkerModalOpen(true); }}
                isAdmin={user.role === "admin" || user.role === "gerente"}
              />
            </TabsContent>

            <TabsContent value="interactions" className="m-0 outline-none">
              <InteractionGoalsTab 
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onEdit={(goal) => { setEditingInteractionGoal(goal); setIsInteractionGoalModalOpen(true); }}
                onNew={() => { setEditingInteractionGoal(null); setIsInteractionGoalModalOpen(true); }}
                isAdmin={user.role === "admin" || user.role === "gerente"}
              />
            </TabsContent>
          </Tabs>

          {/* Modals */}
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
            onOpenChange={setIsResultModalOpen}
            selectedGoal={selectedGoalForResults}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
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
            open={isInteractionGoalModalOpen}
            onOpenChange={setIsInteractionGoalModalOpen}
            editingGoal={editingInteractionGoal}
            users={users}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </div>
      </main>
    );
  }

