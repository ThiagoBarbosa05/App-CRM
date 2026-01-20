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

export default function Configurations() {
  const { user } = useAuth();

  // Verificar se o usuário é administrador
  if (!user || user.role !== "admin") {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 overflow-auto">
          <div className="p-6 flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Acesso Restrito
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Esta página é restrita apenas para administradores
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Você não possui permissão para acessar as configurações do
                  sistema. Entre em contato com um administrador se precisar
                  fazer alterações.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="flex-1 flex flex-col">
          <div className="bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 px-6 py-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-4">
                <Settings className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    Configurações
                  </h2>
                  <p className="text-gray-600 dark:text-slate-400 mt-1">
                    Gerencie as configurações do sistema
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* <div className="flex items-center gap-3 mb-6">
            <Settings className="h-8 w-8 text-wine-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Configurações
              </h1>
              <p className="text-gray-600">
                Gerencie as configurações do sistema
              </p>
            </div>
          </div> */}

          <Tabs defaultValue="users" className="space-y-6 mt-6">
            <div className="relative">
              <TabsList className="w-full h-auto p-1 bg-white dark:bg-slate-900/50 shadow-sm rounded-lg border border-gray-200 dark:border-slate-700">
                <div className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-12 gap-1">
                  <TabsTrigger
                    value="users"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Gerenciar usuários do sistema"
                  >
                    <Users className="size-4 " />
                    <span className="text-xs font-medium ">Usuários</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="categories"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Gerenciar categorias"
                  >
                    <Tags className="size-4" />
                    <span className="text-xs font-medium ">Categorias</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="markers"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Gerenciar marcadores"
                  >
                    <Bookmark className="size-4" />
                    <span className="text-xs font-medium ">Marcadores</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="origins"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Gerenciar origens"
                  >
                    <Tag className="size-4" />
                    <span className="text-xs font-medium ">Origens</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="sectors"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Gerenciar setores"
                  >
                    <LayoutPanelTop className="size-4" />
                    <span className="text-xs font-medium ">Setores</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="events"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Gerenciar eventos"
                  >
                    <CalendarIcon className="size-4" />
                    <span className="text-xs font-medium ">Eventos</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="learning-images"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Gerenciar treinamentos"
                  >
                    <GraduationCap className="size-4" />
                    <span className="text-xs font-medium ">Treinamentos</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="cashback"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Configurações de cashback"
                  >
                    <CircleDollarSign className="size-4" />
                    <span className="text-xs font-medium ">Cashback</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="debts"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Gerenciar dívidas de clientes"
                  >
                    <BookMarked className="size-4" />
                    <span className="text-xs font-medium ">Dívidas</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="export"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-gray-200 dark:data-[state=active]:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-200 text-slate-700 dark:text-slate-300"
                    title="Exportar dados do sistema"
                  >
                    <Download className="size-4" />
                    <span className="text-xs font-medium ">Exportação</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="automation"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm  data-[state=active]:text-purple-700 data-[state=active]:border data-[state=active]:border-gray-200 hover:bg-white/50 dark:data-[state=active]:bg-gray-700 dark:hover:bg-gray-700/50 transition-all duration-200"
                    title="Configurações de automação"
                  >
                    <Bot className="size-4" />
                    <span className="text-xs font-medium ">Automação</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="deal-questions"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm  data-[state=active]:text-purple-700 data-[state=active]:border data-[state=active]:border-gray-200 hover:bg-white/50 dark:data-[state=active]:bg-gray-700 dark:hover:bg-gray-700/50 transition-all duration-200"
                    title="Gerenciar perguntas dos deals"
                  >
                    <HelpCircle className="size-4" />
                    <span className="text-xs font-medium ">Questionário</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="umbler-sync"
                    className="flex flex-col items-center font-medium justify-center gap-1.5 p-3 min-h-[60px] data-[state=active]:bg-primary/25 data-[state=active]:shadow-sm  data-[state=active]:text-purple-700 data-[state=active]:border data-[state=active]:border-gray-200 hover:bg-white/50 dark:data-[state=active]:bg-gray-700 dark:hover:bg-gray-700/50 transition-all duration-200"
                    title="Gerenciar sincronização com Umbler"
                  >
                    <RefreshCcw className="size-4" />
                    <span className="text-xs font-medium ">Umbler Sync</span>
                  </TabsTrigger>
                </div>
              </TabsList>
            </div>

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

            <TabsContent value="umbler-sync">
              <UmblerSyncManagement />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
