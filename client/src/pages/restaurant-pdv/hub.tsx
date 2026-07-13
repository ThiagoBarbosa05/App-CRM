import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowLeft, ClipboardList, UtensilsCrossed } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const TABS = [
  { href: "/pdv-restaurante/comandas", label: "Comandas", icon: ClipboardList },
  { href: "/pdv-restaurante/cardapio", label: "Cardápio", icon: UtensilsCrossed },
];

export default function RestaurantPdvHub({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();

  const isActive = (tab: (typeof TABS)[number]) =>
    location === tab.href || location.startsWith(tab.href + "/");

  const activeTab = TABS.find(isActive) ?? TABS[0];

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
          <UtensilsCrossed className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">PDV Restaurante</span>
        </div>

        <Separator orientation="vertical" className="h-5 shrink-0" />

        {/* Desktop tabs — hidden on small screens */}
        <nav className="hidden sm:flex items-center gap-1 flex-1 overflow-x-auto">
          {TABS.map((tab) => (
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
              {TABS.map((tab) => (
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

        <Separator orientation="vertical" className="h-5 shrink-0 hidden sm:block" />

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-sm shrink-0 hidden sm:inline-flex"
          onClick={() => navigate("/pdv-restaurante")}
        >
          Abrir PDV
        </Button>
      </header>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
