import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AcompanhamentoFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function AcompanhamentoFilters({
  searchQuery,
  setSearchQuery,
}: AcompanhamentoFiltersProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-4 rounded-xl shadow-sm relative z-10">
      <div className="relative group">
        <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 h-5 w-5 transition-colors group-hover:text-blue-500" />
        <Input
          type="text"
          placeholder="Buscar clientes por nome, telefone ou CPF..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/80 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 dark:focus-visible:border-blue-400 transition-all text-base rounded-lg shadow-inner"
        />
      </div>
    </div>
  );
}
