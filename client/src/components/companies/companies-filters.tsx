import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface CompaniesFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  nomeFantasiaFilter: string;
  setNomeFantasiaFilter: (val: string) => void;
  razaoSocialFilter: string;
  setRazaoSocialFilter: (val: string) => void;
  cnpjFilter: string;
  setCnpjFilter: (val: string) => void;
  responsavelFilter: string;
  setResponsavelFilter: (val: string) => void;
  markerFilter: string;
  setMarkerFilter: (val: string) => void;
  users: any[];
  markers: any[];
  onClearFilters: () => void;
}

export function CompaniesFilters({
  searchQuery,
  setSearchQuery,
  nomeFantasiaFilter,
  setNomeFantasiaFilter,
  razaoSocialFilter,
  setRazaoSocialFilter,
  cnpjFilter,
  setCnpjFilter,
  responsavelFilter,
  setResponsavelFilter,
  markerFilter,
  setMarkerFilter,
  users,
  markers,
  onClearFilters,
}: CompaniesFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasActiveFilters = 
    searchQuery || 
    nomeFantasiaFilter || 
    razaoSocialFilter || 
    cnpjFilter || 
    responsavelFilter || 
    markerFilter;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-4 rounded-2xl shadow-sm relative z-10 transition-all">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative group flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 h-5 w-5 transition-colors group-hover:text-blue-500" />
            <Input
              type="text"
              placeholder="Busca geral por nome, cnpj ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/80 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 dark:focus-visible:border-blue-400 transition-all text-base rounded-xl shadow-inner"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`h-12 rounded-xl border-slate-200 dark:border-slate-800 flex-1 md:flex-none px-5 transition-all ${showAdvanced ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : ''}`}
            >
              <Filter className={`mr-2 h-4 w-4 ${showAdvanced ? 'animate-pulse' : ''}`} />
              Filtros Avançados
            </Button>
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={onClearFilters}
                className="h-12 rounded-xl text-slate-500 hover:text-red-500 transition-colors px-4"
                title="Limpar todos os filtros"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 border-t border-slate-100 dark:border-slate-800 mt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                    Nome Fantasia
                  </label>
                  <Input
                    placeholder="Filtrar por nome..."
                    value={nomeFantasiaFilter}
                    onChange={(e) => setNomeFantasiaFilter(e.target.value)}
                    className="h-10 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/80 rounded-lg"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                    Razão Social
                  </label>
                  <Input
                    placeholder="Filtrar por razão..."
                    value={razaoSocialFilter}
                    onChange={(e) => setRazaoSocialFilter(e.target.value)}
                    className="h-10 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/80 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                    CNPJ
                  </label>
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={cnpjFilter}
                    onChange={(e) => setCnpjFilter(e.target.value)}
                    className="h-10 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/80 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                    Responsável
                  </label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-slate-300"
                    value={responsavelFilter}
                    onChange={(e) => setResponsavelFilter(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {users.map((user: any) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                    Marcador
                  </label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-slate-300"
                    value={markerFilter}
                    onChange={(e) => setMarkerFilter(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {markers.map((marker: any) => (
                      <option key={marker.id} value={marker.name}>
                        {marker.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
