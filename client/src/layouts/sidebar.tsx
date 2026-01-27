import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  Gift,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Target,
  User,
  Users,
  Video,
  Wine,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

interface AppSidebarProps {
  onCloseSidebar: (value: boolean) => void;
}

export function AppSidebar({ onCloseSidebar }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const closeMobileMenu = () => {
    onCloseSidebar(false);
  };

  return (
    <aside className="w-72 bg-white dark:bg-slate-900 p-5 shadow-lg border-r border-slate-200 dark:border-slate-800 h-full overflow-auto flex flex-col">
      <Button
        className="absolute lg:hidden top-0 right-0 hover:bg-slate-100 dark:hover:bg-slate-800"
        variant={"ghost"}
        size={"icon"}
        onClick={closeMobileMenu}
      >
        <X className="text-slate-600 dark:text-slate-400" />
      </Button>

      <div className="flex text-xl font-semibold mt-5 lg:mt-0 items-center gap-2 text-slate-900 dark:text-slate-100">
        <Wine className="text-purple-600 dark:text-purple-400" />
        CRM - Grand Cru
      </div>

      <Separator className="mt-5 bg-slate-200 dark:bg-slate-800" />

      {user && (
        <div className="mt-5 flex bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800/50 items-start p-3 rounded-lg gap-3 shadow-sm">
          <div className="bg-purple-100 dark:bg-purple-800/30 rounded-full p-2 flex items-center justify-center">
            <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex flex-col min-w-0 text-sm items-start gap-2">
            <span className="leading-none font-semibold text-slate-900 dark:text-slate-100">
              {user.name}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 w-full block truncate text-ellipsis overflow-hidden">
              {user.email}
            </span>
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-medium">
              {user.role}
            </Badge>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-col gap-1 mt-5">
        <Link href="/dashboard">
          <button
            onClick={closeMobileMenu}
            className={cn(
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/dashboard"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/dashboard" ? { backgroundColor: "#9334ea" } : {}
            }
          >
            <LayoutDashboard className="size-4 mr-3" />
            <span className="mobile-text">Dashboard</span>
          </button>
        </Link>
        <Link href="/clientes">
          <button
            onClick={closeMobileMenu}
            className={cn(
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/clientes"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/clientes" ? { backgroundColor: "#9334ea" } : {}
            }
          >
            <Users className="mr-3 h-4 w-4" />
            <span className="mobile-text">Clientes</span>
          </button>
        </Link>
        <Link href="/umbler/contacts">
          <button
            onClick={closeMobileMenu}
            className={cn(
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/umbler/contacts"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/umbler/contacts"
                ? { backgroundColor: "#9334ea" }
                : {}
            }
          >
            <Users className="mr-3 h-4 w-4" />
            <span className="mobile-text">Umbler Contatos</span>
          </button>
        </Link>
        <Link href="/acompanhamento">
          <button
            onClick={closeMobileMenu}
            className={cn(
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/acompanhamento"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/acompanhamento"
                ? { backgroundColor: "#9334ea" }
                : {}
            }
          >
            <ClipboardList className="mr-3 h-4 w-4" />
            <span className="mobile-text">Acompanhamento</span>
          </button>
        </Link>

        <Link href="/empresas">
          <button
            onClick={closeMobileMenu}
            className={cn(
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/empresas"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/empresas" ? { backgroundColor: "#9334ea" } : {}
            }
          >
            <Building2 className="mr-3 h-4 w-4" />
            <span className="mobile-text">Empresas</span>
          </button>
        </Link>

        <Link href="/products">
          <button
            onClick={closeMobileMenu}
            className={cn(
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/products"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/products" ? { backgroundColor: "#9334ea" } : {}
            }
          >
            <Wine className="mr-3 h-4 w-4" />
            <span className="mobile-text">Produtos</span>
          </button>
        </Link>

        {(user?.role === "admin" || user?.role === "vendedor") && (
          <Link href="/funil">
            <button
              onClick={closeMobileMenu}
              className={cn(
                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
                location === "/funil"
                  ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
              )}
              style={
                location === "/funil" ? { backgroundColor: "#9334ea" } : {}
              }
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
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/calendario"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/calendario" ? { backgroundColor: "#9334ea" } : {}
            }
          >
            <CalendarDays className="mr-3 h-4 w-4" />
            <span className="mobile-text">Aniversários</span>
          </button>
        </Link>

        <Link href="/metas">
          <button
            onClick={closeMobileMenu}
            className={cn(
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/metas"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={location === "/metas" ? { backgroundColor: "#9334ea" } : {}}
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
                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
                location === "/relatorios"
                  ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
              )}
              style={
                location === "/relatorios" ? { backgroundColor: "#9334ea" } : {}
              }
            >
              <BarChart3 className="mr-3 h-4 w-4" />
              <span className="mobile-text">Relatórios</span>
            </button>
          </Link>
        )}

        {/* {(user?.role === "admin" || user?.role === "gerente") && (
          <Link href="/bling/vendas">
            <button
              onClick={closeMobileMenu}
              className={cn(
                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
                location === "/bling/vendas"
                  ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
              )}
              style={
                location === "/bling/vendas"
                  ? { backgroundColor: "#9334ea" }
                  : {}
              }
            >
              <ShoppingCart className="mr-3 h-4 w-4" />
              <span className="mobile-text">Vendas Bling</span>
            </button>
          </Link>
        )} */}

        <Link href="/assistente-ia">
          <button
            onClick={closeMobileMenu}
            className={cn(
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/assistente-ia"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/assistente-ia"
                ? { backgroundColor: "#9334ea" }
                : {}
            }
          >
            <Sparkles className="mr-3 h-4 w-4" />
            <span className="mobile-text">IA Assistente</span>
          </button>
        </Link>

        <Link href="/treinamentos">
          <button
            onClick={closeMobileMenu}
            className={cn(
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/treinamentos"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/treinamentos" ? { backgroundColor: "#9334ea" } : {}
            }
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
                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
                location === "/admin-metas"
                  ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
              )}
              style={
                location === "/admin-metas"
                  ? { backgroundColor: "#9334ea" }
                  : {}
              }
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
              "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
              location === "/cashback"
                ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
            style={
              location === "/cashback" ? { backgroundColor: "#9334ea" } : {}
            }
          >
            <Gift className="mr-3 h-4 w-4" />
            <span className="mobile-text">Cashback</span>
          </button>
        </Link>

        {user?.role !== "vendedor" && (
          <Link href="/configuracoes">
            <button
              onClick={closeMobileMenu}
              className={cn(
                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-200 mobile-button",
                location === "/configuracoes"
                  ? "text-white shadow-md shadow-purple-600/20 dark:shadow-purple-900/40"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
              )}
              style={
                location === "/configuracoes"
                  ? { backgroundColor: "#9334ea" }
                  : {}
              }
            >
              <Settings className="mr-3 h-4 w-4" />
              <span className="mobile-text">Configurações</span>
            </button>
          </Link>
        )}
      </nav>
      <Separator className="mt-5 bg-slate-200 dark:bg-slate-800" />

      <div className="flex px-4 mt-5 items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Tema
        </span>
        <ThemeToggle />
      </div>

      <Button
        variant="ghost"
        className="w-full mt-4 justify-start text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
        onClick={() => {
          logout();
          window.location.reload();
          closeMobileMenu();
        }}
      >
        <LogOut className="mr-3 h-4 w-4" />
        <span className="mobile-text">Sair</span>
      </Button>
    </aside>
  );
}
