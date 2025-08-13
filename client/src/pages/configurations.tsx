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
  CircleDollarSign,
  Download,
  GraduationCap,
  Grid,
  LayoutPanelTop,
  Settings,
  Tag,
  Tags,
  Users,
} from "lucide-react";
import UsersManagement from "@/components/users-management";
import CategoriesManagement from "@/components/categories-management";
import MarkersManagement from "@/components/markers-management";
import OriginsManagement from "@/components/origins-management";
import SectorsManagement from "@/components/sectors-management";
import LearningImagesManagement from "@/components/learning-images-management";
import CashbackSettingsManagement from "@/components/cashback-settings-management";
import DataExportManagement from "@/components/data-export-management";
import { Separator } from "@/components/ui/separator";

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
          <div className="flex items-center gap-3 mb-6">
            <Settings className="h-8 w-8 text-wine-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Configurações
              </h1>
              <p className="text-gray-600">
                Gerencie as configurações do sistema
              </p>
            </div>
          </div>

          <Tabs defaultValue="users" className="space-y-4  ">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger title="usuários" value="users">
                <span className="hidden sm:block">Usuários</span>
                <Users className="size-4 sm:hidden" />
              </TabsTrigger>
              <TabsTrigger title="categorias" value="categories">
                <span className="hidden sm:block">Categorias</span>
                <Tags className="size-4 sm:hidden" />
              </TabsTrigger>
              <TabsTrigger title="marcadores" value="markers">
                <span className="hidden sm:block">Marcadores</span>
                <Bookmark className="size-4 sm:hidden" />
              </TabsTrigger>
              <TabsTrigger title="origens" value="origins">
                <span className="hidden sm:block">Origens</span>
                <Tag className="size-4 sm:hidden" />
              </TabsTrigger>
              <TabsTrigger title="setores" value="sectors">
                <span className="hidden sm:block">Setores</span>
                <LayoutPanelTop className="size-4 sm:hidden" />
              </TabsTrigger>
              <TabsTrigger title="treinamentos" value="learning-images">
                <span className="hidden sm:block">Treinamentos</span>
                <GraduationCap className="size-4 sm:hidden" />
              </TabsTrigger>
              <TabsTrigger title="cashback" value="cashback">
                <span className="hidden sm:block">Cashback</span>
                <CircleDollarSign className="size-4 sm:hidden" />
              </TabsTrigger>
              <TabsTrigger title="exportação" value="export">
                <span className="hidden sm:block">Exportação</span>
                <Download className="size-4 sm:hidden" />
              </TabsTrigger>
            </TabsList>

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

            <TabsContent value="learning-images" className="h-full">
              <LearningImagesManagement />
            </TabsContent>

            <TabsContent value="cashback">
              <CashbackSettingsManagement />
            </TabsContent>

            <TabsContent value="export">
              <DataExportManagement />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
