import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Calculator,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Compass,
  Gift,
  GitBranch,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageCircle,
  PhoneCall,
  Settings,
  Share2,
  ShoppingBag,
  Sparkles,
  Target,
  UtensilsCrossed,
  Zap,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface AppSidebarProps {
  onCloseSidebar: (value: boolean) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  roles?: string[];
  hideForRoles?: string[];
  activeBasePath?: string;
};

const navItems: NavItem[] = [
  { href: "/copiloto", icon: Compass, label: "Copiloto" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/metas", icon: Target, label: "Metas" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/calendario", icon: CalendarDays, label: "Aniversários" },
  { href: "/products", icon: ShoppingBag, label: "Produtos" },
  { href: "/eventos", icon: CalendarDays, label: "Eventos" },
  { href: "/tarefas", icon: CheckSquare, label: "Tarefas" },
  {
    href: "/funil",
    icon: GitBranch,
    label: "Funil de Vendas",
    roles: ["admin", "vendedor"],
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
    href: "/marketing",
    icon: Megaphone,
    label: "Marketing",
    roles: ["admin", "administrador"],
  },
  {
    href: "/automacoes",
    icon: Zap,
    label: "Automações",
    roles: ["admin", "administrador"],
  },
  { href: "/indicacoes", icon: Share2, label: "Indicações" },
  { href: "/telemarketing", icon: PhoneCall, label: "Telemarketing" },
  {
    href: "/whatsapp/conversas",
    icon: MessageCircle,
    label: "WhatsApp",
    activeBasePath: "/whatsapp",
    roles: ["admin"],
  },
  {
    href: "/inbox",
    icon: Inbox,
    label: "Inbox Unificado",
    roles: ["admin", "administrador"],
  },
  {
    href: "/whatsapp/canais",
    icon: MessageCircle,
    label: "Meu WhatsApp",
    roles: ["vendedor"],
  },
  // {
  //   href: "/pdv-restaurante/comandas",
  //   icon: UtensilsCrossed,
  //   label: "PDV Restaurante",
  //   roles: ["admin", "administrador", "gerente"],
  // },
  {
    href: "/configuracoes",
    icon: Settings,
    label: "Configurações",
    hideForRoles: ["vendedor"],
  },
];

export function AppSidebar({
  onCloseSidebar,
  collapsed,
  onToggleCollapse,
}: AppSidebarProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const closeMobileMenu = () => onCloseSidebar(false);

  return (
    <aside className="w-full h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
      {/* Mobile close button */}
      <Button
        className="absolute lg:hidden top-2 right-2 hover:bg-slate-100 dark:hover:bg-slate-800 z-10"
        variant="ghost"
        size="icon"
        onClick={closeMobileMenu}
      >
        <X className="h-4 w-4 text-slate-600 dark:text-slate-400" />
      </Button>

      {/* Header */}
      <div
        className={cn(
          "flex items-center mt-6 lg:mt-0 py-4 shrink-0",
          collapsed ? "justify-center px-3" : "justify-between px-4",
        )}
      >
        {!collapsed && (
          <img
            src="/logo-grand-cru-red%20(1).webp"
            alt="Grand Cru"
            className="h-7 object-contain"
          />
        )}

        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex shrink-0 h-8 w-8 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          onClick={onToggleCollapse}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Separator className="bg-slate-100 dark:bg-slate-800 shrink-0" />

      {/* User info */}
      <div className="px-3 pt-3">
        {user && (
          <>
            {collapsed ? (
              <div className="flex justify-center mb-2">
                <div
                  title={user.name}
                  className="bg-accent rounded-full p-2.5 cursor-default"
                >
                  <User className="h-4 w-4 text-primary" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border mb-3">
                <div className="bg-accent rounded-full p-2 shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col min-w-0 gap-1">
                  <span className="text-sm font-semibold leading-none text-foreground truncate">
                    {user.name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                  <Badge className="self-start bg-accent text-primary border-border text-[10px] px-1.5 py-0 h-4 font-medium">
                    {user.role}
                  </Badge>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex flex-col gap-0.5 mt-3 flex-1 overflow-y-auto",
          collapsed ? "px-2" : "px-3",
        )}
      >
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
            location === item.href ||
            location.startsWith(
              item.activeBasePath ? item.activeBasePath : `${item.href}/`,
            );

          return (
            <Link key={item.href} href={item.href}>
              <button
                onClick={closeMobileMenu}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center text-left rounded-lg font-medium transition-all duration-200 group",
                  collapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-all duration-200",
                    !collapsed && "mr-3",
                    !isActive &&
                      "group-hover:scale-110 group-hover:text-primary",
                  )}
                />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("shrink-0 mt-3 pb-4", collapsed ? "px-2" : "px-3")}>
        <Separator className="mb-3 bg-slate-100 dark:bg-slate-800" />

        {/* Theme toggle */}
        {collapsed ? (
          <div className="flex justify-center mb-1">
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tema
            </span>
            <ThemeToggle />
          </div>
        )}

        {/* Logout */}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "w-full text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium mt-1",
            collapsed ? "justify-center" : "justify-start",
          )}
          onClick={async () => {
            closeMobileMenu();
            await logout();
            window.location.href = "/";
          }}
        >
          <LogOut className={cn("h-4 w-4 shrink-0", !collapsed && "mr-2")} />
          {!collapsed && <span className="text-sm">Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
