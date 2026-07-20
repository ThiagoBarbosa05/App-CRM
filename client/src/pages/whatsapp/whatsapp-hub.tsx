import { type ReactNode, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppNotifications } from "@/hooks/useWhatsAppNotifications.tsx";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowLeft,
  Bot,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  MessageCircle,
  Menu,
  Phone,
  Send,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const ALL_TABS = [
  { href: "/whatsapp/conversas", label: "Conversas", icon: MessageCircle, hideForRoles: [] as string[] },
  { href: "/whatsapp/campanhas", label: "Campanhas", icon: Send, hideForRoles: ["vendedor"] },
  { href: "/whatsapp/bots", label: "Bots", icon: Bot, hideForRoles: ["vendedor"] },
  { href: "/whatsapp/historico-bots", label: "Histórico de Bots", icon: History, hideForRoles: ["vendedor"] },
  { href: "/whatsapp/templates", label: "Templates", icon: FileText, hideForRoles: ["vendedor"] },
  { href: "/whatsapp/atendentes", label: "Atendentes", icon: Users, hideForRoles: ["vendedor"] },
  { href: "/whatsapp/canais", label: "Canais", icon: Phone, hideForRoles: ["vendedor"] },
  { href: "/whatsapp/configuracoes", label: "Configurações", icon: Settings2, hideForRoles: ["vendedor"] },
  { href: "/whatsapp/monitor", label: "Monitor Meta", icon: Activity, hideForRoles: ["vendedor"] },
];

export default function WhatsAppHub({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const clientsRef = useRef<{ id: string; name: string }[]>([]);
  useWhatsAppNotifications(clientsRef);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("whatsapp-sidebar-collapsed") === "true",
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("whatsapp-sidebar-collapsed", String(next));
      return next;
    });
  };

  const visibleTabs = ALL_TABS.filter(
    (tab) => !user || !tab.hideForRoles.includes(user.role),
  );

  const isActive = (tab: (typeof ALL_TABS)[number]) =>
    location === tab.href || location.startsWith(tab.href + "/");

  const activeTab = visibleTabs.find(isActive) ?? visibleTabs[0];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-card border-r border-border shadow-lg lg:shadow-none",
          "transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col overflow-hidden shrink-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-16" : "w-56",
        )}
      >
        {/* Mobile close button */}
        <Button
          className="absolute lg:hidden top-2 right-2 h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>

        {/* Header */}
        <div
          className={cn(
            "flex items-center mt-6 lg:mt-0 py-3 shrink-0",
            collapsed ? "justify-center px-2" : "justify-between px-3",
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground shrink-0"
            onClick={() => navigate("/")}
            title="Voltar ao CRM"
          >
            <ArrowLeft className="h-4 w-4" />
            {!collapsed && <span className="ml-1">CRM</span>}
          </Button>

          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex shrink-0 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={toggleCollapsed}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {collapsed && (
          <div className="hidden lg:flex justify-center pb-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={toggleCollapsed}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Separator className="shrink-0" />

        <div className={cn("flex items-center gap-1.5 py-3 shrink-0", collapsed ? "justify-center px-2" : "px-3")}>
          <MessageCircle className="h-4 w-4 text-green-500 shrink-0" />
          {!collapsed && <span className="text-sm font-semibold">WhatsApp</span>}
        </div>

        <Separator className="shrink-0" />

        {/* Navigation */}
        <nav
          className={cn(
            "flex flex-col gap-0.5 mt-3 flex-1 overflow-y-auto overflow-x-hidden",
            collapsed ? "px-2" : "px-3",
          )}
        >
          {visibleTabs.map((tab) => (
            <Link key={tab.href} href={tab.href}>
              <button
                onClick={() => setMobileOpen(false)}
                title={collapsed ? tab.label : undefined}
                className={cn(
                  "w-full flex items-center text-left rounded-lg font-medium transition-all duration-200 group",
                  collapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                  isActive(tab)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <tab.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-all duration-200",
                    !collapsed && "mr-3",
                    !isActive(tab) && "group-hover:scale-110 group-hover:text-primary",
                  )}
                />
                {!collapsed && <span className="text-sm truncate">{tab.label}</span>}
              </button>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-3 h-12 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5 text-muted-foreground" />
          </Button>
          <activeTab.icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{activeTab.label}</span>
        </header>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
