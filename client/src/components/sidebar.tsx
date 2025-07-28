import { Wine, Users, BarChart3, Settings, User, GitBranch, CalendarDays, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "./ui/button";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="sm:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMobileMenu}
          className="bg-white shadow-md"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="sm:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "bg-white shadow-lg border-r border-gray-200 transition-transform duration-300 ease-in-out z-40",
        "sm:relative sm:translate-x-0 sm:w-64",
        "fixed left-0 top-0 h-full w-80 max-w-[80vw]",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="mobile-responsive py-4 sm:p-6">
          <div className="flex items-center space-x-3 mb-6 sm:mb-8">
            <Wine className="h-6 w-6 sm:h-8 sm:w-8 text-bordeaux-600" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Grand Cru</h1>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => {
                onTabChange("clientes");
                closeMobileMenu();
              }}
              className={cn(
                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                activeTab === "clientes"
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Users className="mr-3 h-4 w-4" />
              <span className="mobile-text">Clientes</span>
            </button>

            <button
              onClick={() => {
                onTabChange("funil");
                closeMobileMenu();
              }}
              className={cn(
                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                activeTab === "funil"
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <GitBranch className="mr-3 h-4 w-4" />
              <span className="mobile-text">Funil de Vendas</span>
            </button>

            

            <Link href="/reports" onClick={closeMobileMenu}>
              <button 
                className={cn(
                  "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                  location === "/reports"
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <BarChart3 className="mr-3 h-4 w-4" />
                <span className="mobile-text">Relatórios</span>
              </button>
            </Link>

            <Link href="/calendario" onClick={closeMobileMenu}>
              <button 
                className={cn(
                  "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                  location === "/calendario"
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <CalendarDays className="mr-3 h-4 w-4" />
                <span className="mobile-text">Calendário</span>
              </button>
            </Link>

            <button
              onClick={() => {
                onTabChange("configuracoes");
                closeMobileMenu();
              }}
              className={cn(
                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                activeTab === "configuracoes"
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Settings className="mr-3 h-4 w-4" />
              <span className="mobile-text">Configurações</span>
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}