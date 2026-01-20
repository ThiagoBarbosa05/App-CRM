import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // Memoiza o handler para evitar re-renders desnecessários
  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label={`Alternar para tema ${theme === "light" ? "escuro" : "claro"}`}
            aria-pressed={theme === "dark"}
            className="h-8 w-8 px-0 relative hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="relative flex items-center justify-center">
              <Sun className="h-[1.2rem] w-[1.2rem] text-slate-700 dark:text-slate-400 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] text-slate-700 dark:text-slate-400 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
            </span>
            <span className="sr-only">
              Alternar tema (atualmente:{" "}
              {theme === "light" ? "claro" : "escuro"})
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-700 dark:border-slate-300"
        >
          <p className="text-xs font-medium">
            {theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
