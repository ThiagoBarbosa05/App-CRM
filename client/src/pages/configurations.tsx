import { Settings } from "lucide-react";
import Sidebar from "@/components/sidebar";
import CashbackSettingsManagement from "@/components/cashback-settings-management";

export default function Configurations() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
              <p className="text-gray-600">Gerencie as configurações do sistema</p>
            </div>
          </div>

          <div className="space-y-6">
            <CashbackSettingsManagement />
          </div>
        </div>
      </div>
    </div>
  );
}