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
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-sm relative z-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <Input
            placeholder="Buscar por nome ou referência..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800/80 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 dark:focus-visible:border-blue-400 transition-all shadow-sm rounded-xl text-base"
          />
        </div>

        <div className="relative group">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full h-12 pl-4 pr-10 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all appearance-none cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900 shadow-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="ESPUMANTE">🥂 Espumante</option>
            <option value="BRANCO">🥂 Branco</option>
            <option value="ROSE">🍷 Rose</option>
            <option value="TINTO">🍷 Tinto</option>
            <option value="PÓS-REFEIÇÃO">🥃 Pós-refeição</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <div className="relative group">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-full h-12 pl-4 pr-10 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all appearance-none cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900 shadow-sm"
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
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <div className="relative group">
          <select
            value={volumeFilter}
            onChange={(e) => setVolumeFilter(e.target.value)}
            className="w-full h-12 pl-4 pr-10 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all appearance-none cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900 shadow-sm"
          >
            <option value="">Todos os volumes</option>
            <option value="187ml">187ml</option>
            <option value="375ml">375ml</option>
            <option value="750ml">750ml</option>
            <option value="1.5L">1.5L</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
