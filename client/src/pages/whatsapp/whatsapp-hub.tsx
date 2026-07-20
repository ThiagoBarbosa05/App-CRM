import { type ReactNode, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppNotifications } from "@/hooks/useWhatsAppNotifications.tsx";
import { cn } from "@/lib/utils";
import { Activity, Bot, FileText, History, MessageCircle, Phone, Send, Settings2, ArrowLeft, ChevronDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ALL_TABS = [
  { href: "/whatsapp/conversas",     label: "Conversas",    icon: MessageCircle, hideForRoles: [] as string[] },
  { href: "/whatsapp/campanhas",     label: "Campanhas",    icon: Send,          hideForRoles: ["vendedor"] },
  { href: "/whatsapp/bots",          label: "Bots",         icon: Bot,           hideForRoles: ["vendedor"] },
  { href: "/whatsapp/historico-bots",label: "Histórico de Bots", icon: History, hideForRoles: ["vendedor"] },
  { href: "/whatsapp/templates",     label: "Templates",    icon: FileText,      hideForRoles: ["vendedor"] },
  { href: "/whatsapp/canais",        label: "Canais",       icon: Phone,         hideForRoles: ["vendedor"] },
  { href: "/whatsapp/configuracoes", label: "Configurações",icon: Settings2,     hideForRoles: ["vendedor"] },
  { href: "/whatsapp/monitor",      label: "Monitor Meta", icon: Activity,      hideForRoles: ["vendedor"] },
];

export default function WhatsAppHub({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const clientsRef = useRef<{ id: string; name: string }[]>([]);
  useWhatsAppNotifications(clientsRef);

  const visibleTabs = ALL_TABS.filter(
    (tab) => !user || !tab.hideForRoles.includes(user.role),
  );

  const isActive = (tab: (typeof ALL_TABS)[number]) =>
    location === tab.href || location.startsWith(tab.href + "/");

  const activeTab = visibleTabs.find(isActive) ?? visibleTabs[0];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-12 border-b border-border bg-card shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground shrink-0"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">CRM</span>
        </Button>

        <Separator orientation="vertical" className="h-5 shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <MessageCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold">WhatsApp</span>
        </div>

        <Separator orientation="vertical" className="h-5 shrink-0" />

        {/* Desktop tabs — hidden on small screens */}
        <nav className="hidden sm:flex items-center gap-1 flex-1 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <Link key={tab.href} href={tab.href}>
              <button
                className={cn(
                  "flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                  isActive(tab)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <tab.icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                {tab.label}
              </button>
            </Link>
          ))}
        </nav>

        {/* Mobile dropdown — visible only on small screens */}
        <div className="flex sm:hidden flex-1 justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm font-medium max-w-[160px]"
              >
                <activeTab.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{activeTab.label}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {visibleTabs.map((tab) => (
                <Link key={tab.href} href={tab.href}>
                  <DropdownMenuItem
                    className={cn(
                      "gap-2 cursor-pointer",
                      isActive(tab) && "bg-accent font-medium",
                    )}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </DropdownMenuItem>
                </Link>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
