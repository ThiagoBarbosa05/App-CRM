import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Building2,
  Calculator,
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

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  roles?: string[];
  hideForRoles?: string[];
};

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/umbler/contacts", icon: Users, label: "Umbler Contatos" },
  // { href: "/acompanhamento", icon: ClipboardList, label: "Acompanhamento" },
  // { href: "/empresas", icon: Building2, label: "Empresas" },
  { href: "/products", icon: Wine, label: "Produtos" },
  {
    href: "/funil",
    icon: GitBranch,
    label: "Funil de Vendas",
    roles: ["admin", "vendedor"],
  },
  { href: "/calendario", icon: CalendarDays, label: "Aniversários" },
  { href: "/metas", icon: Target, label: "Metas" },
  {
    href: "/vendas",
    icon: ShoppingCart,
    label: "Vendas (BETA)",
    roles: ["admin", "gerente"],
  },
  { href: "/assistente-ia", icon: Sparkles, label: "IA Assistente" },
  { href: "/treinamentos", icon: Video, label: "Treinamentos" },
  {
    href: "/calculadora-vinho",
    icon: Calculator,
    label: "Calculadora de Vinho",
  },
  { href: "/cashback", icon: Gift, label: "Cashback" },
  {
    href: "/configuracoes",
    icon: Settings,
    label: "Configurações",
    hideForRoles: ["vendedor"],
  },
];

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
        {navItems.map((item) => {
          if (item.roles && (!user || !item.roles.includes(user.role)))
            return null;
          if (
            item.hideForRoles &&
            user &&
            item.hideForRoles.includes(user.role)
          )
            return null;

          const isActive =
            location === item.href || location.startsWith(`${item.href}/`);

          return (
            <Link key={item.href} href={item.href}>
              <button
                onClick={closeMobileMenu}
                className={cn(
                  "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-all duration-300 mobile-button group",
                  isActive
                    ? "text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-md shadow-purple-600/30 dark:shadow-purple-900/40"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 hover:translate-x-1",
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 shrink-0 transition-transform duration-300",
                    !isActive &&
                      "group-hover:scale-110 group-hover:text-purple-600 dark:group-hover:text-purple-400",
                  )}
                />
                <span className="mobile-text">{item.label}</span>
              </button>
            </Link>
          );
        })}
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
