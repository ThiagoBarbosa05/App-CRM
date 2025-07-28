import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Reports from "@/pages/reports";
import Calendar from "@/pages/calendar";
import Metas from "@/pages/metas";
import NotFound from "@/pages/not-found";
import ClientsTable from "./components/clients-table";
import SettingsManagement from "./components/settings-management";
import VendorDashboard from "./components/vendor-dashboard";
import KanbanBoard from "./components/kanban-board";
import CompaniesManagement from "./components/companies-management";
import { useState } from "react";

function Sidebar({ activeTab, setActiveTab }) {
  return (
    <div className="w-64 bg-gray-100 h-screen">
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-4">Menu</h2>
        <ul>
          <li
            className={`p-2 cursor-pointer ${
              activeTab === "home" ? "bg-gray-200" : ""
            }`}
            onClick={() => setActiveTab("home")}
          >
            Home
          </li>
          <li
            className={`p-2 cursor-pointer ${
              activeTab === "reports" ? "bg-gray-200" : ""
            }`}
            onClick={() => setActiveTab("reports")}
          >
            Reports
          </li>
          <li
            className={`p-2 cursor-pointer ${
              activeTab === "calendario" ? "bg-gray-200" : ""
            }`}
            onClick={() => setActiveTab("calendario")}
          >
            Calendario
          </li>
          <li
            className={`p-2 cursor-pointer ${
              activeTab === "metas" ? "bg-gray-200" : ""
            }`}
            onClick={() => setActiveTab("metas")}
          >
            Metas
          </li>
          <li
            className={`p-2 cursor-pointer ${
              activeTab === "configuracoes" ? "bg-gray-200" : ""
            }`}
            onClick={() => setActiveTab("configuracoes")}
          >
            Configurações
          </li>
          <li
            className={`p-2 cursor-pointer ${
              activeTab === "empresas" ? "bg-gray-200" : ""
            }`}
            onClick={() => setActiveTab("empresas")}
          >
            Empresas
          </li>
        </ul>
      </div>
    </div>
  );
}

function MainContent({ activeTab }) {
  return (
    <div className="flex-1 p-4">
      <div>
        {activeTab === "home" && <div>Home Content</div>}
        {activeTab === "reports" && <div>Reports Content</div>}
        {activeTab === "calendario" && <div>Calendario Content</div>}
        {activeTab === "metas" && <div>Metas Content</div>}
        {activeTab === "configuracoes" && <SettingsManagement />}
        {activeTab === "empresas" && <CompaniesManagement />}
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("home");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <div className="flex h-screen">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <MainContent activeTab={activeTab} />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;