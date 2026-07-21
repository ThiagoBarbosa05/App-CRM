import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Settings,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/pdv-restaurante/cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { href: "/pdv-restaurante/mesas", label: "Configurar Mesas", icon: Settings },
  { href: "/pdv-restaurante/relatorios", label: "Relatórios", icon: BarChart3 },
];

interface PdvSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCloseSidebar: () => void;
}

export function PdvSidebar({ collapsed, onToggleCollapse, onCloseSidebar }: PdvSidebarProps) {
  const [location, navigate] = useLocation();

  const isActive = (tab: (typeof TABS)[number]) =>
    location === tab.href || location.startsWith(tab.href + "/");

  return (
    <aside className="w-full h-full bg-card border-r border-border flex flex-col overflow-hidden">
      <Button
        className="absolute lg:hidden top-2 right-2 hover:bg-accent z-10"
        variant="ghost"
        size="icon"
        onClick={onCloseSidebar}
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </Button>

      <div
        className={cn(
          "flex items-center mt-6 lg:mt-0 py-4 shrink-0",
          collapsed ? "justify-center px-3" : "justify-between px-4",
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <UtensilsCrossed className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold">PDV Restaurante</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex shrink-0 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <Separator className="shrink-0" />

      {/* Botão principal — Mesas (mapa operacional) */}
      <div className={cn("mt-3 shrink-0", collapsed ? "px-2" : "px-3")}>
        <button
          onClick={() => { navigate("/pdv-restaurante"); onCloseSidebar(); }}
          title={collapsed ? "Mesas" : undefined}
          className={cn(
            "w-full flex items-center text-left rounded-lg font-medium transition-all duration-200 group",
            "bg-orange-500 text-white shadow-sm hover:bg-orange-600",
            collapsed ? "justify-center p-2.5" : "px-3 py-2.5",
          )}
        >
          <LayoutGrid
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-all duration-200",
              !collapsed && "mr-3",
            )}
          />
          {!collapsed && <span className="text-sm">Mesas</span>}
        </button>
      </div>

      <nav
        className={cn(
          "flex flex-col gap-0.5 mt-2 flex-1 overflow-y-auto",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href}>
            <button
              onClick={onCloseSidebar}
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
              {!collapsed && <span className="text-sm">{tab.label}</span>}
            </button>
          </Link>
        ))}
      </nav>

      <div className={cn("shrink-0 mb-3 pb-4", collapsed ? "px-2" : "px-3")}>
        <Separator className="mb-3" />

        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          title={collapsed ? "Voltar ao CRM" : undefined}
          className={cn(
            "w-full text-muted-foreground hover:text-foreground",
            collapsed ? "justify-center" : "justify-start",
          )}
          onClick={() => navigate("/")}
        >
          <ArrowLeft className={cn("h-4 w-4 shrink-0", !collapsed && "mr-2")} />
          {!collapsed && <span className="text-sm">Voltar ao CRM</span>}
        </Button>
      </div>
    </aside>
  );
}
