import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import Settings from "@/pages/settings";
import AIAssistant from "@/pages/ai-assistant";
import NotFound from "@/pages/not-found";
import { lazy } from 'react';

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
      <Route path="/clientes" component={Clients} />
      <Route path="/empresas" component={Companies} />
      <Route path="/funil" component={Funnel} />
      <Route path="/files" component={lazy(() => import("./pages/files"))} />
      <Route path="/reports" component={Reports} />
      <Route path="/calendario" component={Calendar} />
      <Route path="/metas" component={Metas} />
      <Route path="/admin-metas" component={AdminGoals} />
      <Route path="/assistente-ia" component={AIAssistant} />
      <Route path="/configuracoes" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;