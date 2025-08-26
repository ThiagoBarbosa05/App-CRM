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
  Gift,
  ClipboardList,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActive = (href: string) => location === href;

  return (
    <>
      {/* Mobile menu button */}
      <div className="sm:hidden fixed top-3 left-5">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMobileMenu}
          className="bg-background border border-border shadow-md"
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
          "bg-background dark:bg-background shadow-lg border-r border-border transition-transform duration-300 ease-in-out z-40 flex flex-col",
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
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">
              GRAND CRU
            </h1>
          </div>

          {/* User Info Section */}
          <div className="mb-4 sm:mb-6 p-3 bg-accent rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
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

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent dark:scrollbar-thumb-muted">
          <div className="mobile-responsive px-4 sm:px-6">
            <nav className="space-y-2">
              <Link href="/dashboard">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    isActive("/dashboard")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <BarChart3 className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Dashboard</span>
                </button>
              </Link>

              <Link href="/clientes">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    isActive("/clientes")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Users className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Clientes</span>
                </button>
              </Link>

              <Link href="/acompanhamento">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    isActive("/acompanhamento")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <ClipboardList className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Acompanhamento</span>
                </button>
              </Link>

              <Link href="/empresas">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    isActive("/empresas")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Building2 className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Empresas</span>
                </button>
              </Link>

              {(user?.role === "admin" || user?.role === "vendedor") && (
                <Link href="/funil">
                  <button
                    onClick={closeMobileMenu}
                    className={cn(
                      "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                      isActive("/funil")
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <GitBranch className="mr-3 h-4 w-4" />
                    <span className="mobile-text">Funil de Vendas</span>
                  </button>
                </Link>
              )}

              <Link href="/calendario">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    isActive("/calendario")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <CalendarDays className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Aniversários</span>
                </button>
              </Link>

              <Link href="/metas">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    isActive("/metas")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Target className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Metas</span>
                </button>
              </Link>

              {user?.role !== "vendedor" && (
                <Link href="/relatorios">
                  <button
                    onClick={closeMobileMenu}
                    className={cn(
                      "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                      isActive("/relatorios")
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <BarChart3 className="mr-3 h-4 w-4" />
                    <span className="mobile-text">Relatórios</span>
                  </button>
                </Link>
              )}

              <Link href="/assistente-ia">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    isActive("/assistente-ia")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
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
                    isActive("/treinamentos")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
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
                      isActive("/admin-metas")
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Shield className="mr-3 h-4 w-4" />
                    <span className="mobile-text">Admin Metas</span>
                  </button>
                </Link>
              )}

              <Link href="/cashback">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    isActive("/cashback")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Gift className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Cashback</span>
                </button>
              </Link>

              <Link href="/products">
                <button
                  onClick={closeMobileMenu}
                  className={cn(
                    "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                    isActive("/products")
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Wine className="mr-3 h-4 w-4" />
                  <span className="mobile-text">Produtos</span>
                </button>
              </Link>

              {user?.role !== "vendedor" && (
                <Link href="/configuracoes">
                  <button
                    onClick={closeMobileMenu}
                    className={cn(
                      "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                      isActive("/configuracoes")
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    <span className="mobile-text">Configurações</span>
                  </button>
                </Link>
              )}
            </nav>
          </div>
        </div>

        {/* User Actions Section */}
        <div className="flex-shrink-0 mobile-responsive px-4 sm:px-6 pb-4 sm:pb-6">
          <Separator className="mb-4" />
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Tema</span>
              <ThemeToggle />
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
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