import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Companies from "@/pages/companies";
import Reports from "@/pages/reports";
import Calendar from "@/pages/calendar";
import Metas from "@/pages/metas";
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
      <Route path="/empresas" component={Companies} />
      <Route path="/files" component={lazy(() => import("./pages/files"))} />
      <Route path="/reports" component={Reports} />
      <Route path="/calendario" component={Calendar} />
      <Route path="/metas" component={Metas} />
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