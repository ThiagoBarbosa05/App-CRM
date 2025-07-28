import { useState } from "react";
import Sidebar from "@/components/sidebar";
import SettingsManagement from "@/components/settings-management";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("configuracoes");

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <SettingsManagement />
        </div>
      </main>
    </div>
  );
}