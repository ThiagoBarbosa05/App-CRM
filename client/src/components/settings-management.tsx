import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import UsersManagement from "./users-management";
import CategoriesManagement from "./categories-management";
import MarkersManagement from "./markers-management";
import OriginsManagement from "./origins-management";

export default function SettingsManagement() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-8 w-8 text-wine-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600">Gerencie as configurações do sistema</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Usuários do Sistema</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="markers">Marcadores</TabsTrigger>
          <TabsTrigger value="origins">Origens</TabsTrigger>
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
      </Tabs>
    </div>
  );
}