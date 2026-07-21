import { type ReactNode, useState, useEffect } from "react";
import { Menu, Building2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdvSidebar } from "./pdv-sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { PdvUnit } from "@shared/schema";
import { getPdvCurrentUnitId, setPdvCurrentUnitId } from "@/lib/pdv-unit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function UnitSwitcher() {
  const [currentUnitId, setCurrentUnitId] = useState<string | null>(
    () => getPdvCurrentUnitId(),
  );

  const { data: units = [] } = useQuery<PdvUnit[]>({
    queryKey: ["/api/restaurant-pdv/units"],
  });

  useEffect(() => {
    const handler = (e: CustomEvent) => setCurrentUnitId(e.detail);
    window.addEventListener("pdvUnitChanged" as any, handler);
    return () => window.removeEventListener("pdvUnitChanged" as any, handler);
  }, []);

  useEffect(() => {
    if (units.length > 0 && !currentUnitId) {
      const firstActive = units.find((u) => u.isActive) ?? units[0];
      if (firstActive) {
        setPdvCurrentUnitId(firstActive.id);
        setCurrentUnitId(firstActive.id);
      }
    }
  }, [units, currentUnitId]);

  const currentUnit = units.find((u) => u.id === currentUnitId);

  const handleSelect = (id: string) => {
    setPdvCurrentUnitId(id);
    setCurrentUnitId(id);
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 text-xs font-medium max-w-[200px]"
        >
          <Building2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <span className="truncate">{currentUnit?.name ?? "Selecionar unidade"}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Unidade PDV</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {units.filter((u) => u.isActive).map((u) => (
          <DropdownMenuItem
            key={u.id}
            onSelect={() => handleSelect(u.id)}
            className="gap-2"
          >
            <Check
              className={cn("h-3.5 w-3.5", u.id === currentUnitId ? "opacity-100" : "opacity-0")}
            />
            <div className="flex flex-col">
              <span className="text-sm">{u.name}</span>
              {u.cnpj && <span className="text-xs text-muted-foreground">{u.cnpj}</span>}
            </div>
          </DropdownMenuItem>
        ))}
        {units.filter((u) => u.isActive).length === 0 && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            Nenhuma unidade cadastrada
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function RestaurantPdvHub({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("pdv-sidebar-collapsed") === "true",
  );

  const isGestor = user?.role === "admin" || user?.role === "gerente";

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("pdv-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`
          fixed inset-y-0 left-0 z-50 shadow-lg
          transform transition-all duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${collapsed ? "w-16" : "w-64"}
        `}
      >
        <PdvSidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          onCloseSidebar={() => setSidebarOpen(false)}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header — mobile + seletor de unidade (gestor) */}
        <header className="flex items-center px-3 py-2 bg-card shadow-sm border-b border-border gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </Button>
          <span className="text-sm font-semibold lg:hidden">PDV Restaurante</span>
          <div className="ml-auto">
            {isGestor && <UnitSwitcher />}
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
