import {
  Wine,
  Users,
  Building2,
  BarChart3,
  Settings,
  GitBranch,
  CalendarDays,
  Menu,
  X,
  Target,
  Shield,
  Sparkles,
  Video,
  User,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="sm:hidden absolute top-3 left-5">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMobileMenu}
          className="bg-white shadow-md"
        >
          {isMobileMenuOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
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
      <div
        className={cn(
          "bg-white shadow-lg border-r border-gray-200 transition-transform duration-300 ease-in-out z-40 flex flex-col",
          "sm:relative sm:translate-x-0 sm:w-64",
          "fixed left-0 top-0 bottom-0 h-full w-80 max-w-[80vw]",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mobile-responsive py-4 sm:p-6 flex-shrink-0">
          <div
            className="flex items-center space-x-3 mb-4 sm:mb-6 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              window.location.href = "/clientes";
              closeMobileMenu();
            }}
          >
            <Wine className="h-6 w-6 sm:h-8 sm:w-8 text-purple-700" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
              GRAND CRU
            </h1>
          </div>

          {/* User Info Section */}
          <div className="mb-4 sm:mb-6 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || "Usuário"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email || ""}
                </p>
              </div>
            </div>
            {user?.role && (
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs">
                  {user.role === "admin" ? "Administrador" : 
                   user.role === "gerente" ? "Gerente" :
                   user.role === "vendedor" ? "Vendedor" : "Usuário"}
                </Badge>
              </div>
            )}
          </div>
          
          <Separator className="mb-4 sm:mb-6" />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="mobile-responsive px-4 sm:px-6">
            <nav className="space-y-2">
              <Link href="/clientes">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/clientes"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100",
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
                      : "text-gray-700 hover:bg-gray-100",
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
                      : "text-gray-700 hover:bg-gray-100",
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
                      : "text-gray-700 hover:bg-gray-100",
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
                      : "text-gray-700 hover:bg-gray-100",
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
                      : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <BarChart3 className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Relatórios</span>
                </button>
              </Link>

              <Link href="/assistente-ia">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    location === "/assistente-ia"
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100",
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
                      : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <Video className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Treinamentos</span>
                </button>
              </Link>

              {(user?.role === "admin" || user?.role === "gerente") && (
                <Link href="/admin-metas">
                  <button
                    onClick={closeMobileMenu}
                    className={cn(
                      "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                      location === "/admin-metas"
                        ? "bg-primary text-white"
                        : "text-gray-700 hover:bg-gray-100",
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
                      : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <Settings className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Configurações</span>
                </button>
              </Link>
            </nav>
          </div>
        </div>

        {/* User Actions Section */}
        <div className="flex-shrink-0 mobile-responsive px-4 sm:px-6 pb-4 sm:pb-6">
          <Separator className="mb-4" />
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                logout();
                window.location.reload();
                closeMobileMenu();
              }}
            >
              <LogOut className="mr-3 h-4 w-4" />
              <span className="mobile-text">Sair</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
