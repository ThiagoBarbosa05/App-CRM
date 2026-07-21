import { Switch, Route, Redirect, useLocation } from "wouter";
import { lazy, Suspense } from "react";
import WhatsAppHub from "@/pages/whatsapp/whatsapp-hub";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { MainLayout } from "./layouts/main-layout";
import { LoadingScreen } from "@/components/loading-screen";
import { PageTitleUpdater } from "@/components/page-title-updater";
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
import Marketing from "@/pages/marketing";
import AutomationsPage from "@/pages/automations";
import Configurations from "@/pages/configurations";
import DashboardPage from "./pages/dashboard";
import Products from "./pages/products";
import ProductProfilePage from "./pages/product-profile";
import ProductDuplicatesPage from "./pages/product-duplicates";
import SellerDashboardPage from "./pages/seller-dashboard";
import SellerPerformancePage from "./pages/seller-performance";
import ClientProfilePage from "./pages/client-profile";
import DuplicatesPage from "./pages/duplicates";
import ClientsRegistrationQualityPage from "./pages/clients-registration-quality";
import CalculadoraVinho from "./pages/calculadora-vinho";
import EventsPage from "./pages/events";
import TarefasPage from "./pages/tarefas";
import RankingPage from "./pages/ranking";
import CopilotoPage from "./pages/copiloto";
import TelemarketingPage from "./pages/telemarketing";
import ReferralProgramPage from "./pages/referral-program";
import ZernioInboxPage from "./pages/zernio-inbox";
import RestaurantPos from "@/pages/restaurant-pdv/pos";
import RestaurantPdvHub from "@/pages/restaurant-pdv/hub";

const WhatsAppCampaignsList = lazy(() => import("@/pages/whatsapp/campaigns-list"));
const WhatsAppCreateCampaign = lazy(() => import("@/pages/whatsapp/create-campaign"));
const WhatsAppCampaignDetails = lazy(() => import("@/pages/whatsapp/campaign-details"));
const WhatsAppTemplates = lazy(() => import("@/pages/whatsapp/templates"));
const WhatsAppSettings = lazy(() => import("@/pages/whatsapp/settings"));
const WhatsAppChannels = lazy(() => import("@/pages/whatsapp/channels"));
const WhatsAppAttendants = lazy(() => import("@/pages/whatsapp/attendants"));
const WhatsAppBotsList = lazy(() => import("@/pages/whatsapp/bots-list"));
const WhatsAppBotHistory = lazy(() => import("@/pages/whatsapp/bot-history"));
const WhatsAppBotEditor = lazy(() => import("@/pages/whatsapp/bot-editor"));
const WhatsAppConversations = lazy(() => import("@/pages/whatsapp/conversations"));
const WhatsAppMetaMonitor = lazy(() => import("@/pages/whatsapp/meta-monitor"));
const RestaurantMenuManagement = lazy(() => import("@/pages/restaurant-pdv/menu-management"));
const RestaurantReports = lazy(() => import("@/pages/restaurant-pdv/reports"));
const RestaurantCashSession = lazy(() => import("@/pages/restaurant-pdv/cash-session"));
const PdvSettings = lazy(() => import("@/pages/restaurant-pdv/settings"));

// Páginas do módulo WhatsApp que um vendedor pode acessar diretamente pela
// URL — as demais (campanhas, templates, atendentes, bots, etc.) já ficam
// escondidas da navegação (ver hideForRoles em whatsapp-hub.tsx), mas sem
// esse guard um vendedor ainda conseguia abri-las digitando a URL.
const VENDEDOR_ALLOWED_WHATSAPP_PATHS = ["/whatsapp/conversas", "/whatsapp/canais"];

function WhatsAppSection() {
  const { user } = useAuth();
  const [location] = useLocation();

  if (
    user?.role === "vendedor" &&
    !VENDEDOR_ALLOWED_WHATSAPP_PATHS.some(
      (path) => location === path || location.startsWith(path + "/"),
    )
  ) {
    return <Redirect to="/whatsapp/conversas" />;
  }

  return (
    <WhatsAppHub>
      <Suspense fallback={null}>
        <Switch>
          <Route path="/whatsapp/campanhas/criar" component={WhatsAppCreateCampaign} />
          <Route path="/whatsapp/campanhas/:id" component={WhatsAppCampaignDetails} />
          <Route path="/whatsapp/campanhas" component={WhatsAppCampaignsList} />
          <Route path="/whatsapp/templates" component={WhatsAppTemplates} />
          <Route path="/whatsapp/configuracoes" component={WhatsAppSettings} />
          <Route path="/whatsapp/canais" component={WhatsAppChannels} />
          <Route path="/whatsapp/atendentes" component={WhatsAppAttendants} />
          <Route path="/whatsapp/bots" component={WhatsAppBotsList} />
          <Route path="/whatsapp/historico-bots" component={WhatsAppBotHistory} />
          <Route path="/whatsapp/conversas" component={WhatsAppConversations} />
          <Route path="/whatsapp/monitor" component={WhatsAppMetaMonitor} />
        </Switch>
      </Suspense>
    </WhatsAppHub>
  );
}

function RestaurantPdvSection() {
  const { user } = useAuth();

  // Cardápio, caixa e relatórios são todos `requireGestor` (admin/gerente) no
  // backend. O garçom já é barrado antes, no `Router`, mas o vendedor caía
  // aqui: abria a tela inteira, via a tabela de histórico vazia por causa de um
  // 403 silencioso e só descobria o bloqueio ao clicar em "Fechar caixa".
  if (user?.role !== "admin" && user?.role !== "gerente") {
    return <Redirect to="/" />;
  }

  return (
    <RestaurantPdvHub>
      <Suspense fallback={null}>
        <Switch>
          <Route path="/pdv-restaurante/cardapio" component={RestaurantMenuManagement} />
          <Route path="/pdv-restaurante/caixa" component={RestaurantCashSession} />
          <Route path="/pdv-restaurante/relatorios" component={RestaurantReports} />
          <Route path="/pdv-restaurante/configuracoes" component={PdvSettings} />
        </Switch>
      </Suspense>
    </RestaurantPdvHub>
  );
}

function Router() {
  const { user, login, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  if (user.role === "garcom") {
    return (
      <Switch>
        <Route path="/pdv-restaurante" component={RestaurantPos} />
        <Route component={() => <Redirect to="/pdv-restaurante" />} />
      </Switch>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
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
        path="/clientes/qualidade-cadastro"
        component={() => (
          <MainLayout>
            <ClientsRegistrationQualityPage />
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
      {/* Legacy /umbler/* redirects to WhatsApp section */}
      <Route path="/umbler/campaigns/create" component={() => <Redirect to="/whatsapp/campanhas/criar" />} />
      <Route path="/umbler/campaigns/:id" component={() => <Redirect to="/whatsapp/campanhas" />} />
      <Route path="/umbler/campaigns" component={() => <Redirect to="/whatsapp/campanhas" />} />
      <Route path="/umbler/contacts" component={() => <Redirect to="/whatsapp/campanhas" />} />
      {/* WhatsApp section */}
      <Route
        path="/whatsapp/bots/:id/editor"
        component={() =>
          user.role === "vendedor" ? (
            <Redirect to="/whatsapp/conversas" />
          ) : (
            <WhatsAppBotEditor />
          )
        }
      />
      <Route path="/whatsapp/campanhas/criar" component={WhatsAppSection} />
      <Route path="/whatsapp/campanhas/:id" component={WhatsAppSection} />
      <Route path="/whatsapp/:rest*" component={WhatsAppSection} />

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
        path="/products/duplicatas"
        component={() => (
          <MainLayout>
            <ProductDuplicatesPage />
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
      <Route
        path="/marketing"
        component={() => (
          <MainLayout>
            <Marketing />
          </MainLayout>
        )}
      />
      <Route
        path="/automacoes"
        component={() => (
          <MainLayout>
            <AutomationsPage />
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
        path="/copiloto"
        component={() => (
          <MainLayout>
            <CopilotoPage />
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
      <Route
        path="/inbox"
        component={() => (
          <MainLayout>
            <ZernioInboxPage />
          </MainLayout>
        )}
      />
      {/* PDV Restaurante — hub próprio, separado do CRM (sem MainLayout/sidebar) */}
      <Route path="/pdv-restaurante" component={RestaurantPos} />
      <Route path="/pdv-restaurante/:rest*" component={RestaurantPdvSection} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vinocrm-ui-theme">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <PageTitleUpdater />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
