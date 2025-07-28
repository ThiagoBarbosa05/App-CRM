import { Wine, Users, BarChart3, Settings, User, GitBranch, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";

interface SidebarProps {
  activeTab: "clientes" | "funis" | "configuracoes";
  onTabChange: (tab: "clientes" | "funis" | "configuracoes") => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [location] = useLocation();
  return (
    <div className="w-64 bg-white sidebar-shadow flex flex-col">
      {/* Logo & Title */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[var(--wine-red)] rounded-lg flex items-center justify-center">
            <Wine className="text-white text-lg h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">VinoCRM</h1>
            <p className="text-sm text-gray-500">Gestão de Clientes</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        <Link href="/">
          <button
            className={cn(
              "w-full flex items-center px-4 py-3 text-left rounded-lg font-medium transition-colors",
              location === "/" && activeTab === "clientes"
                ? "bg-primary text-white"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <Users className="mr-3 h-4 w-4" />
            Clientes
          </button>
        </Link>

        <button
          onClick={() => onTabChange("funis")}
          className={cn(
            "w-full flex items-center px-4 py-3 text-left rounded-lg font-medium transition-colors",
            activeTab === "funis"
              ? "bg-primary text-white"
              : "text-gray-700 hover:bg-gray-100"
          )}
        >
          <GitBranch className="mr-3 h-4 w-4" />
          Funis de Vendas
        </button>



        <Link href="/reports">
          <button 
            className={cn(
              "w-full flex items-center px-4 py-3 text-left rounded-lg font-medium transition-colors",
              location === "/reports"
                ? "bg-primary text-white"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <BarChart3 className="mr-3 h-4 w-4" />
            Relatórios
          </button>
        </Link>

        <Link href="/calendario">
          <button 
            className={cn(
              "w-full flex items-center px-4 py-3 text-left rounded-lg font-medium transition-colors",
              location === "/calendario"
                ? "bg-primary text-white"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <CalendarDays className="mr-3 h-4 w-4" />
            Calendário
          </button>
        </Link>

        <button
          onClick={() => onTabChange("configuracoes")}
          className={cn(
            "w-full flex items-center px-4 py-3 text-left rounded-lg font-medium transition-colors",
            activeTab === "configuracoes"
              ? "bg-primary text-white"
              : "text-gray-700 hover:bg-gray-100"
          )}
        >
          <Settings className="mr-3 h-4 w-4" />
          Configurações
        </button>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <User className="text-white text-sm h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">João Silva</p>
            <p className="text-xs text-gray-500">Proprietário</p>
          </div>
        </div>
      </div>
    </div>
  );
}