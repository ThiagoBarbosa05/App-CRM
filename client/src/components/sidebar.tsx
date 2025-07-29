import { Wine, Users, Building2, BarChart3, Settings, GitBranch, CalendarDays, Menu, X, Target, Shield, Sparkles, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

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
        "bg-white shadow-lg border-r border-gray-200 transition-transform duration-300 ease-in-out z-40 flex flex-col",
        "sm:relative sm:translate-x-0 sm:w-64",
        "fixed left-0 top-0 h-full w-80 max-w-[80vw]",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="mobile-responsive py-4 sm:p-6 flex-shrink-0">
          <div 
            className="flex items-center space-x-3 mb-6 sm:mb-8 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              window.location.href = "/clientes";
              closeMobileMenu();
            }}
          >
            <Wine className="h-6 w-6 sm:h-8 sm:w-8 text-purple-700" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">GRAND CRU</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="mobile-responsive px-4 sm:px-6 pb-6">
            <nav className="space-y-2">
              <Link href="/clientes">
                <button 
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/clientes"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Users className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Clientes</span>
                </button>
              </Link>

              <Link href="/empresas">
                <button 
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/empresas"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Building2 className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Empresas</span>
                </button>
              </Link>

              <Link href="/funil">
                <button 
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/funil"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <GitBranch className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Funil de Vendas</span>
                </button>
              </Link>

              <Link href="/calendario">
                <button 
                  onClick={closeMobileMenu}
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

              <Link href="/metas">
                <button 
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/metas"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Target className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Metas</span>
                </button>
              </Link>

              <Link href="/relatorios">
                <button 
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/relatorios"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <BarChart3 className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Relatórios</span>
                </button>
              </Link>

              <Link href="/ia-assistente">
                <button 
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/ia-assistente"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Sparkles className="mr-3 h-4 w-4" />
                  <span className="mobile-text">IA Assistente</span>
                </button>
              </Link>

              <Link href="/treinamentos">
                <button 
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/treinamentos"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Video className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Treinamentos</span>
                </button>
              </Link>

              {(user?.role === "administrador" || user?.role === "gerente") && (
                <Link href="/admin-metas">
                  <button 
                    onClick={closeMobileMenu}
                    className={cn(
                      "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                      location === "/admin-metas"
                        ? "bg-primary text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Shield className="mr-3 h-4 w-4" />
                    <span className="mobile-text">Admin Metas</span>
                  </button>
                </Link>
              )}

              <Link href="/configuracoes">
                <button 
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/configuracoes"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Settings className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Configurações</span>
                </button>
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}