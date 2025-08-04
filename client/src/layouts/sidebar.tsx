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
    Gift,
    GitBranch,
    LogOut,
    Menu,
    Settings,
    Shield,
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
        <aside className="w-72 bg-white p-5 shadow-lg border-r border-gray-200 h-full flex flex-col">
            <Button
                className="absolute lg:hidden top-0 right-0"
                variant={"ghost"}
                size={"icon"}
                onClick={closeMobileMenu}
            >
                <X />
            </Button>

            <div className="flex text-xl font-semibold mt-5 lg:mt-0 items-center gap-2">
                <Wine className="text-[#7c3aed]" />
                CRM - Grand Cru
            </div>

            <Separator className="mt-5 bg-gray-300" />

            <div className="mt-5 flex bg-purple-100 items-start p-2 rounded-md gap-2">
                <div className="bg-purple-50 rounded-full p-1 flex items-center justify-center">
                    <User />
                </div>
                <div className="flex flex-col text-sm items-start gap-2">
                    <span className="leading-none font-semibold">
                        Thiago Barbosa
                    </span>
                    <span className="leading-none text-gray-700">
                        estoque@email.com
                    </span>
                    <Badge>Administrador</Badge>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 mt-5">
                <Link href="/clientes">
                    <button
                        onClick={closeMobileMenu}
                        className={cn(
                            "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                            location === "/clientes"
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                    >
                        <Users className="mr-3 h-4 w-4" />
                        <span className="mobile-text">Clientes</span>
                    </button>
                </Link>

                <Link href="/empresas">
                    <button
                        onClick={closeMobileMenu}
                        className={cn(
                            "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                            location === "/empresas"
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                    >
                        <Building2 className="mr-3 h-4 w-4" />
                        <span className="mobile-text">Empresas</span>
                    </button>
                </Link>

                {user?.role === "admin" && (
                    <Link href="/funil">
                        <button
                            onClick={closeMobileMenu}
                            className={cn(
                                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                                location === "/funil"
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
                            location === "/calendario"
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                    >
                        <CalendarDays className="mr-3 h-4 w-4" />
                        <span className="mobile-text">Calendário</span>
                    </button>
                </Link>

                <Link href="/metas">
                    <button
                        onClick={closeMobileMenu}
                        className={cn(
                            "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                            location === "/metas"
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
                                location === "/relatorios"
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
                            location === "/assistente-ia"
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
                            location === "/treinamentos"
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
                                location === "/admin-metas"
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
                            location === "/cashback"
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
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
                                "w-full flex items-center px-3 py-2 sm:px-4 sm:py-3 text-left rounded-lg font-medium transition-colors mobile-button",
                                location === "/configuracoes"
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
            <Separator className="mt-5 bg-gray-300" />

            <div className="flex px-4 mt-5 items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                    Tema
                </span>
                <ThemeToggle />
            </div>

            <Button
                variant="ghost"
                className="w-full justify-start text-red-500 hover:text-red-400 "
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
