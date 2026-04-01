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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Bookmark,
  BookMarked,
  Bot,
  CalendarIcon,
  CircleDollarSign,
  Download,
  GraduationCap,
  Grid,
  LayoutPanelTop,
  Settings,
  Tag,
  Tags,
  Users,
  HelpCircle,
  Link2,
  RefreshCcw,
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
import EventsManagement from "@/components/events-management";
import { Separator } from "@/components/ui/separator";
import { AutomationManagement } from "@/components/automation-management";
import { DealQuestionsManagement } from "@/components/deal-questions-management";
import UmblerSyncManagement from "@/components/umbler-sync-management";
import { ConfigurationsHeader } from "@/components/configurations/configurations-header";
import { motion, AnimatePresence } from "framer-motion";
import BlingAccountsManagement from "@/components/bling-accounts-management";

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
                Você não possui permissão para acessar o núcleo de configurações do sistema. 
                Por favor, entre em contato com a equipe de suporte ou um administrador master para solicitar acesso.
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
    <div className="flex-1 flex flex-col p-4 lg:p-10 space-y-10">
      <ConfigurationsHeader />

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="space-y-8"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-slate-900/5 dark:bg-white/5 rounded-3xl blur-xl -z-10" />
          <TabsList className="h-auto w-full p-2 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-[2.5rem] border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
            <div className="flex flex-wrap items-center justify-center gap-2 w-full p-1">
                  <TabsTrigger
                    value="users"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar usuários do sistema"
                  >
                    <Users className="size-4 " />
                    <span className="text-xs font-medium ">Usuários</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="categories"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar categorias"
                  >
                    <Tags className="size-4" />
                    <span className="text-xs font-medium ">Categorias</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="markers"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar marcadores"
                  >
                    <Bookmark className="size-4" />
                    <span className="text-xs font-medium ">Marcadores</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="origins"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar origens"
                  >
                    <Tag className="size-4" />
                    <span className="text-xs font-medium ">Origens</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="sectors"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar setores"
                  >
                    <LayoutPanelTop className="size-4" />
                    <span className="text-xs font-medium ">Setores</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="events"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar eventos"
                  >
                    <CalendarIcon className="size-4" />
                    <span className="text-xs font-medium ">Eventos</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="learning-images"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar treinamentos"
                  >
                    <GraduationCap className="size-4" />
                    <span className="text-xs font-medium ">Treinamentos</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="cashback"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Configurações de cashback"
                  >
                    <CircleDollarSign className="size-4" />
                    <span className="text-xs font-medium ">Cashback</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="debts"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar dívidas de clientes"
                  >
                    <BookMarked className="size-4" />
                    <span className="text-xs font-medium ">Dívidas</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="export"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Exportar dados do sistema"
                  >
                    <Download className="size-4" />
                    <span className="text-xs font-medium ">Exportação</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="automation"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Configurações de automação"
                  >
                    <Bot className="size-4" />
                    <span className="text-xs font-medium ">Automação</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="deal-questions"
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar perguntas dos deals"
                  >
                    <HelpCircle className="size-4" />
                    <span className="text-xs font-medium ">Questionário</span>
                  </TabsTrigger>

                   <TabsTrigger
                     value="bling-accounts"
                     className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                       data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                       data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                       text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                     title="Gerenciar contas Bling conectadas"
                   >
                     <Link2 className="size-4" />
                     <span className="text-xs font-medium ">Contas Bling</span>
                   </TabsTrigger>

                   <TabsTrigger
                     value="umbler-sync"
                     className="flex flex-col items-center justify-center gap-2 px-4 py-3 min-w-[100px] rounded-2xl transition-all duration-300
                       data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 
                      data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 
                      text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                    title="Gerenciar sincronização com Umbler"
                  >
                    <RefreshCcw className="size-4" />
                    <span className="text-xs font-medium ">Umbler Sync</span>
                  </TabsTrigger>
        </div>
      </TabsList>
    </div>

    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative"
      >
        <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-400/5 blur-3xl rounded-[3rem] -z-10" />

            <TabsContent value="users">
              <UsersManagement />
            </TabsContent>

            <TabsContent value="categories">
              <CategoriesManagement />
            </TabsContent>

            <TabsContent value="markers">
              <MarkersManagement />
            </TabsContent>

            <TabsContent value="origins">
              <OriginsManagement />
            </TabsContent>

            <TabsContent value="sectors">
              <SectorsManagement />
            </TabsContent>

            <TabsContent value="events">
              <EventsManagement />
            </TabsContent>

            <TabsContent value="learning-images" className="h-full">
              <LearningImagesManagement />
            </TabsContent>

            <TabsContent value="cashback">
              <CashbackSettingsManagement />
            </TabsContent>

            <TabsContent value="debts">
              <ClientDebtsManagement />
            </TabsContent>

            <TabsContent value="export">
              <DataExportManagement />
            </TabsContent>

            <TabsContent value="automation">
              <AutomationManagement />
            </TabsContent>

             <TabsContent value="deal-questions">
               <DealQuestionsManagement />
             </TabsContent>

             <TabsContent value="bling-accounts">
               <BlingAccountsManagement />
             </TabsContent>

             <TabsContent value="umbler-sync">
               <UmblerSyncManagement />
             </TabsContent>
      </motion.div>
    </AnimatePresence>
  </Tabs>
</div>
);
}
