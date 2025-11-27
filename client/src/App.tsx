import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Clients from "@/pages/clients";
import Companies from "@/pages/companies";
import Funnel from "@/pages/funnel";
import Reports from "@/pages/reports";
import Calendar from "@/pages/calendar";
import Metas from "@/pages/metas";
import AdminGoals from "@/pages/admin-goals";
import AIAssistant from "@/pages/ai-assistant";
import NotFound from "@/pages/not-found";
import Trainings from "@/pages/trainings";
import Cashback from "@/pages/cashback";
import Configurations from "@/pages/configurations";
import { MainLayout } from "./layouts/main-layout";
import Acompanhamento from "./pages/acompanhamento";
import DashboardPage from "./pages/dashboard";
import Products from "./pages/products";
import UmblerContactsPage from "./pages/umbler-contacts";
import { lazy } from "react";


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
        path="/umbler/contacts"
        component={() => (
          <MainLayout>
            <UmblerContactsPage />
          </MainLayout>
        )}
      />
      <Route path="/acompanhamento" component={() => (
          <MainLayout>
            <Acompanhamento />
          </MainLayout>
        )} />
      <Route
        path="/empresas"
        component={() => (
          <MainLayout>
            <Companies />
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
        path="/relatorios"
        component={() => (
          <MainLayout>
            <Reports />
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
      <Route path="/admin-metas" component={() => (
          <MainLayout>
            <AdminGoals />
          </MainLayout>
        )} />
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