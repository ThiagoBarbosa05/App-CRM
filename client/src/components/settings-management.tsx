import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

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

      <Card>
        <CardHeader>
          <CardTitle>Página de Configurações</CardTitle>
          <CardDescription>
            Esta página está em desenvolvimento. As funcionalidades serão adicionadas em breve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Em breve você poderá gerenciar usuários, marcadores, categorias e outras configurações do sistema aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}