import { useState } from "react";
import Sidebar from "@/components/sidebar";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AppTabs,
  PillTabsList,
  PillTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";
import {
  AlertTriangle,
  Bookmark,
  BookMarked,
  Bot,
  CircleDollarSign,
  Download,
  GraduationCap,
  Grid,
  Grid3X3,
  LayoutPanelTop,
  Settings,
  Tag,
  Tags,
  Users,
  HelpCircle,
  RefreshCcw,
  DollarSignIcon,
  Sparkles,
  PlugZap,
} from "lucide-react";
import UsersManagement from "@/components/users-management";
import CategoriesManagement from "@/components/categories-management";
import MarkersManagement from "@/components/markers-management";
import OriginsManagement from "@/components/origins-management";
import SectorsManagement from "@/components/sectors-management";
import LearningImagesManagement from "@/components/learning-images-management";
import CashbackSettingsManagement from "@/components/cashback-settings-management";
import ClientDebtsManagement from "@/components/client-debts-management";
import DataExportManagement from "@/components/data-export-management";
import { Separator } from "@/components/ui/separator";
import { AutomationManagement } from "@/components/automation-management";
import { DealQuestionsManagement } from "@/components/deal-questions-management";
import UmblerSyncManagement from "@/components/umbler-sync-management";
import { PageHeader } from "@/components/page-header";
import { motion, AnimatePresence } from "framer-motion";
import { WinePriceTierSettings } from "@/components/settings-management";
import ProductCategoriesManagement from "@/components/product-categories-management";
import { WineAIProfileSettings } from "@/components/wine-ai-profile-settings";
import { IntegrationsManagement } from "@/components/integrations-management";

export default function Configurations() {
  const { user } = useAuth();

  // Verificar se o usuário é administrador
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-lg"
        >
          <Card className="border-0 shadow-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 pointer-events-none" />
            <CardHeader className="relative text-center pt-12 pb-6">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-500/10 text-red-600 shadow-inner">
                <AlertTriangle className="h-10 w-10" />
              </div>
              <CardTitle className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Acesso <span className="text-red-600">Restrito</span>
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-lg mt-2">
                Área exclusiva para administradores.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative text-center pb-12 px-10">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Você não possui permissão para acessar o núcleo de configurações
                do sistema. Por favor, entre em contato com a equipe de suporte
                ou um administrador master para solicitar acesso.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "users";
  });

  return (
    <div className="space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon icon={Settings} />
          <PageHeader.Text>
            <PageHeader.Title>Painel de Configurações</PageHeader.Title>
            <PageHeader.Description>
              Gerencie usuários, categorias e todas as preferências do sistema
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      <AppTabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <PillTabsList className="flex-wrap h-auto">
          <PillTabsTrigger value="users" color="blue">
            <Users className="h-3.5 w-3.5" />Usuários
          </PillTabsTrigger>
          <PillTabsTrigger value="categories" color="blue">
            <Tags className="h-3.5 w-3.5" />Categorias
          </PillTabsTrigger>
          <PillTabsTrigger value="markers" color="blue">
            <Bookmark className="h-3.5 w-3.5" />Marcadores
          </PillTabsTrigger>
          <PillTabsTrigger value="origins" color="blue">
            <Tag className="h-3.5 w-3.5" />Origens
          </PillTabsTrigger>
          <PillTabsTrigger value="sectors" color="blue">
            <LayoutPanelTop className="h-3.5 w-3.5" />Setores
          </PillTabsTrigger>
          <PillTabsTrigger value="learning-images" color="blue">
            <GraduationCap className="h-3.5 w-3.5" />Treinamentos
          </PillTabsTrigger>
          <PillTabsTrigger value="cashback" color="blue">
            <CircleDollarSign className="h-3.5 w-3.5" />Cashback
          </PillTabsTrigger>
          <PillTabsTrigger value="debts" color="blue">
            <BookMarked className="h-3.5 w-3.5" />Dívidas
          </PillTabsTrigger>
          <PillTabsTrigger value="export" color="blue">
            <Download className="h-3.5 w-3.5" />Exportação
          </PillTabsTrigger>
          <PillTabsTrigger value="automation" color="blue">
            <Bot className="h-3.5 w-3.5" />Automação
          </PillTabsTrigger>
          <PillTabsTrigger value="deal-questions" color="blue">
            <HelpCircle className="h-3.5 w-3.5" />Questionário
          </PillTabsTrigger>
          {/* <PillTabsTrigger value="umbler-sync" color="blue">
            <RefreshCcw className="h-3.5 w-3.5" />Umbler Sync
          </PillTabsTrigger> */}
          {/* <PillTabsTrigger value="wine-price-tiers" color="blue">
            <DollarSignIcon className="h-3.5 w-3.5" />Faixas de Preço
          </PillTabsTrigger> */}
          <PillTabsTrigger value="product-categories" color="blue">
            <Grid3X3 className="h-3.5 w-3.5" />Cat. Produto
          </PillTabsTrigger>
          <PillTabsTrigger value="ai-profile" color="purple">
            <Sparkles className="h-3.5 w-3.5" />Perfil IA
          </PillTabsTrigger>
          <PillTabsTrigger value="integrations" color="blue">
            <PlugZap className="h-3.5 w-3.5" />Integrações
          </PillTabsTrigger>
        </PillTabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <AppTabsContent value="users">
              <UsersManagement />
            </AppTabsContent>

            <AppTabsContent value="categories">
              <CategoriesManagement />
            </AppTabsContent>

            <AppTabsContent value="markers">
              <MarkersManagement />
            </AppTabsContent>

            <AppTabsContent value="origins">
              <OriginsManagement />
            </AppTabsContent>

            <AppTabsContent value="sectors">
              <SectorsManagement />
            </AppTabsContent>

            <AppTabsContent value="learning-images" className="h-full">
              <LearningImagesManagement />
            </AppTabsContent>

            <AppTabsContent value="cashback">
              <CashbackSettingsManagement />
            </AppTabsContent>

            <AppTabsContent value="debts">
              <ClientDebtsManagement />
            </AppTabsContent>

            <AppTabsContent value="export">
              <DataExportManagement />
            </AppTabsContent>

            <AppTabsContent value="automation">
              <AutomationManagement />
            </AppTabsContent>

            <AppTabsContent value="deal-questions">
              <DealQuestionsManagement />
            </AppTabsContent>

            <AppTabsContent value="umbler-sync">
              <UmblerSyncManagement />
            </AppTabsContent>

            <AppTabsContent value="wine-price-tiers">
              <WinePriceTierSettings />
            </AppTabsContent>

            <AppTabsContent value="product-categories">
              <ProductCategoriesManagement />
            </AppTabsContent>

            <AppTabsContent value="ai-profile">
              <WineAIProfileSettings />
            </AppTabsContent>

            <AppTabsContent value="integrations">
              <IntegrationsManagement />
            </AppTabsContent>
          </motion.div>
        </AnimatePresence>
      </AppTabs>
    </div>
  );
}
