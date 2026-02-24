import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface ProductsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  countryFilter: string;
  setCountryFilter: (country: string) => void;
  volumeFilter: string;
  setVolumeFilter: (volume: string) => void;
}

export function ProductsFilters({
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  countryFilter,
  setCountryFilter,
  volumeFilter,
  setVolumeFilter,
}: ProductsFiltersProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative z-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <Input
            placeholder="Buscar por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 dark:focus-visible:border-blue-400 transition-all rounded-xl"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-11 px-4 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all appearance-none cursor-pointer"
        >
          <option value="">Todos os tipos</option>
          <option value="ESPUMANTE">🥂 Espumante</option>
          <option value="BRANCO">🥂 Branco</option>
          <option value="ROSE">🍷 Rose</option>
          <option value="TINTO">🍷 Tinto</option>
          <option value="PÓS-REFEIÇÃO">🥃 Pós-refeição</option>
        </select>

        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="h-11 px-4 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all appearance-none cursor-pointer"
        >
          <option value="">Todos os países</option>
          <option value="CHILE">🇨🇱 Chile</option>
          <option value="ARGENTINA">🇦🇷 Argentina</option>
          <option value="URUGUAI">🇺🇾 Uruguai</option>
          <option value="BRASIL">🇧🇷 Brasil</option>
          <option value="EUA">🇺🇸 EUA</option>
          <option value="FRANÇA">🇫🇷 França</option>
          <option value="ITÁLIA">🇮🇹 Itália</option>
          <option value="PORTUGAL">🇵🇹 Portugal</option>
          <option value="ESPANHA">🇪🇸 Espanha</option>
          <option value="ALEMANHA">🇩🇪 Alemanha</option>
          <option value="OUTROS">🌍 Outros</option>
        </select>

        <select
          value={volumeFilter}
          onChange={(e) => setVolumeFilter(e.target.value)}
          className="h-11 px-4 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all appearance-none cursor-pointer"
        >
          <option value="">Todos os volumes</option>
          <option value="187ml">187ml</option>
          <option value="375ml">375ml</option>
          <option value="750ml">750ml</option>
          <option value="1.5L">1.5L</option>
        </select>
      </div>
    </div>
  );
}
