import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { MainLayout } from "./layouts/main-layout";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Clients from "@/pages/clients";
import Companies from "@/pages/companies";
import Funnel from "@/pages/funnel";
import Calendar from "@/pages/calendar";
import Metas from "@/pages/metas";
import AIAssistant from "@/pages/ai-assistant";
import NotFound from "@/pages/not-found";
import Trainings from "@/pages/trainings";
import Cashback from "@/pages/cashback";
import Configurations from "@/pages/configurations";
import DashboardPage from "./pages/dashboard";
import Products from "./pages/products";
import ProductProfilePage from "./pages/product-profile";
import UmblerContactsPage from "./pages/umbler-contacts";
import CreateCampaignPage from "./pages/create-campaign-improved";
import CampaignsDashboardPage from "./pages/campaigns-dashboard";
import CampaignDetailsPage from "./pages/campaign-details";
import SellerDashboardPage from "./pages/seller-dashboard";
import SellerPerformancePage from "./pages/seller-performance";
import ClientProfilePage from "./pages/client-profile";
import DuplicatesPage from "./pages/duplicates";
import CalculadoraVinho from "./pages/calculadora-vinho";
import EventsPage from "./pages/events";
import TarefasPage from "./pages/tarefas";
import RankingPage from "./pages/ranking";
import TelemarketingPage from "./pages/telemarketing";
import ReferralProgramPage from "./pages/referral-program";
function Router() {
  const { user, login, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route
        path="/dashboard"
        component={() => (
          <MainLayout>
            <DashboardPage />
          </MainLayout>
        )}
      />
      <Route
        path="/clientes"
        component={() => (
          <MainLayout>
            <Clients />
          </MainLayout>
        )}
      />
      <Route
        path="/clientes/duplicatas"
        component={() => (
          <MainLayout>
            <DuplicatesPage />
          </MainLayout>
        )}
      />
      <Route
        path="/clientes/:id"
        component={() => (
          <MainLayout>
            <ClientProfilePage />
          </MainLayout>
        )}
      />
      <Route
        path="/umbler/contacts"
        component={() => (
          <MainLayout>
            <UmblerContactsPage />
          </MainLayout>
        )}
      />
      <Route
        path="/umbler/campaigns/create"
        component={() => (
          <MainLayout>
            <CreateCampaignPage />
          </MainLayout>
        )}
      />
      <Route
        path="/umbler/campaigns/:id"
        component={() => (
          <MainLayout>
            <CampaignDetailsPage />
          </MainLayout>
        )}
      />
      <Route
        path="/umbler/campaigns"
        component={() => (
          <MainLayout>
            <CampaignsDashboardPage />
          </MainLayout>
        )}
      />

      <Route
        path="/funil"
        component={() => (
          <MainLayout>
            <Funnel />
          </MainLayout>
        )}
      />

      <Route
        path="/calendario"
        component={() => (
          <MainLayout>
            <Calendar />
          </MainLayout>
        )}
      />
      <Route
        path="/metas"
        component={() => (
          <MainLayout>
            <Metas />
          </MainLayout>
        )}
      />
      <Route
        path="/assistente-ia"
        component={() => (
          <MainLayout>
            <AIAssistant />
          </MainLayout>
        )}
      />
      <Route
        path="/treinamentos"
        component={() => (
          <MainLayout>
            <Trainings />
          </MainLayout>
        )}
      />
      <Route
        path="/products"
        component={() => (
          <MainLayout>
            <Products />
          </MainLayout>
        )}
      />
      <Route
        path="/products/:id"
        component={() => (
          <MainLayout>
            <ProductProfilePage />
          </MainLayout>
        )}
      />
      <Route
        path="/eventos"
        component={() => (
          <MainLayout>
            <EventsPage />
          </MainLayout>
        )}
      />
      <Route
        path="/tarefas"
        component={() => (
          <MainLayout>
            <TarefasPage />
          </MainLayout>
        )}
      />
      <Route
        path="/ranking"
        component={() => (
          <MainLayout>
            <RankingPage />
          </MainLayout>
        )}
      />
      <Route
        path="/configuracoes"
        component={() => (
          <MainLayout>
            <Configurations />
          </MainLayout>
        )}
      />
      <Route
        path="/cashback"
        component={() => (
          <MainLayout>
            <Cashback />
          </MainLayout>
        )}
      />

      {/* <Route
        path="/vendas"
        component={() => (
          <MainLayout>
            <SellerDashboardPage />
          </MainLayout>
        )}
      /> */}
      <Route
        path="/vendedores/:id"
        component={() => (
          <MainLayout>
            <SellerPerformancePage />
          </MainLayout>
        )}
      />
      <Route
        path="/calculadora-vinho"
        component={() => (
          <MainLayout>
            <CalculadoraVinho />
          </MainLayout>
        )}
      />
      <Route
        path="/telemarketing"
        component={() => (
          <MainLayout>
            <TelemarketingPage />
          </MainLayout>
        )}
      />
      <Route
        path="/indicacoes"
        component={() => (
          <MainLayout>
            <ReferralProgramPage />
          </MainLayout>
        )}
      />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vinocrm-ui-theme">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
