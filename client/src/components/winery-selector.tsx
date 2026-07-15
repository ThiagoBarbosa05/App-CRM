import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface Winery {
  id: string;
  name: string;
}

interface WinerySelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function WinerySelector({ value, onChange, placeholder = "Selecione ou busque...", className }: WinerySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: wineries = [], isLoading } = useQuery<Winery[]>({
    queryKey: ["/api/wineries"],
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/wineries", { name });
      return res.json();
    },
    onSuccess: (created: Winery) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wineries"] });
      onChange(created.name);
      setSearch("");
      setOpen(false);
      toast({ title: "Vinícola cadastrada", description: `"${created.name}" foi adicionada com sucesso.` });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível cadastrar a vinícola.", variant: "destructive" });
    },
  });

  const filtered = wineries.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = wineries.some(
    (w) => w.name.toLowerCase() === search.toLowerCase()
  );

  const canCreate = isAdmin && search.trim().length > 0 && !exactMatch;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-12 w-full flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 font-semibold text-sm transition-all focus:ring-2 focus:ring-wine-500/20 focus:border-wine-500 focus:outline-none",
            !value && "text-slate-400",
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="truncate">{value || placeholder}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar vinícola..."
            value={search}
            onValueChange={setSearch}
            className="h-11"
          />
          <CommandList className="max-h-56">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : filtered.length === 0 && !canCreate ? (
              <CommandEmpty className="py-6 text-center text-sm text-slate-400">
                Nenhuma vinícola encontrada.
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((winery) => (
                  <CommandItem
                    key={winery.id}
                    value={winery.name}
                    onSelect={() => {
                      onChange(value === winery.name ? "" : winery.name);
                      setSearch("");
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 cursor-pointer rounded-xl mx-1 my-0.5"
                  >
                    <Check
                      className={cn("h-4 w-4 shrink-0 text-wine-600", value === winery.name ? "opacity-100" : "opacity-0")}
                    />
                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">{winery.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Opção de criar nova (só admin) */}
            {canCreate && (
              <div className="border-t border-slate-100 dark:border-slate-800 p-1.5">
                <button
                  type="button"
                  onClick={() => createMutation.mutate(search.trim())}
                  disabled={createMutation.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-wine-700 dark:text-wine-400 bg-wine-50 dark:bg-wine-900/20 hover:bg-wine-100 dark:hover:bg-wine-900/30 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0" />
                  )}
                  Cadastrar "{search.trim()}"
                </button>
              </div>
            )}

            {/* Aviso para não-admin */}
            {!isAdmin && search.trim().length > 0 && filtered.length === 0 && (
              <div className="p-3 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
                Solicite ao administrador para cadastrar esta vinícola.
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
