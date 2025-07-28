import { useState } from "react";
import Sidebar from "@/components/sidebar";
import FunnelsManagement from "@/components/funnels-management";
import { useAuth } from "@/hooks/useAuth";

export default function Funnel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("funil");

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <FunnelsManagement />
        </div>
      </main>
    </div>
  );
}