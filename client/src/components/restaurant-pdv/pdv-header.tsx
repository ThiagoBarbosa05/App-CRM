import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, LayoutDashboard, LogOut, UtensilsCrossed } from "lucide-react";

/** Chrome superior compartilhado entre o mapa de mesas e a tela de comanda. */
export function PdvHeader() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const isGarcom = user?.role === "garcom";

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
      {!isGarcom && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-muted-foreground"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">CRM</span>
          </Button>
          <Separator orientation="vertical" className="h-5 shrink-0" />
          {user?.role === "admin" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 text-muted-foreground"
              onClick={() => navigate("/pdv-restaurante/admin")}
            >
              <LayoutDashboard className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Painel Admin</span>
            </Button>
          )}
          <Separator orientation="vertical" className="h-5 shrink-0" />
        </>
      )}
      <div className="flex items-center gap-1.5 shrink-0">
        <UtensilsCrossed className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-semibold">PDV Restaurante</span>
      </div>
      {user?.name && (
        <span className={`text-xs text-muted-foreground ${isGarcom ? "" : "ml-auto"}`}>
          {isGarcom ? "" : "Garçom: "}{user.name}
        </span>
      )}
      {isGarcom && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 shrink-0 px-2 text-muted-foreground"
          onClick={() => logout()}
        >
          <LogOut className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      )}
    </header>
  );
}
