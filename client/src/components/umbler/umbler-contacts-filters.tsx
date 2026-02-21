import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UmblerTagSelect from "@/components/umbler-tag-select";
import { Search, Filter, X, Tag } from "lucide-react";

interface UmblerContactsFiltersProps {
  search: string;
  setSearch: (value: string) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  exclusiveTagFilter: boolean;
  setExclusiveTagFilter: (exclusive: boolean) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
}

export function UmblerContactsFilters({
  search,
  setSearch,
  selectedTags,
  setSelectedTags,
  exclusiveTagFilter,
  setExclusiveTagFilter,
  hasActiveFilters,
  clearFilters,
}: UmblerContactsFiltersProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm mb-6">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md">
              <Filter className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Filtros e Pesquisa
            </h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Limpar Filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 transition-shadow h-10"
            />
          </div>
          <div className="relative z-20">
             <UmblerTagSelect
                value={selectedTags}
                onChange={setSelectedTags}
                placeholder="Filtrar por tags..."
             />
          </div>
        </div>

        {/* Opção de filtro exclusivo */}
        {selectedTags.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 pb-1 bg-slate-50/50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800/50">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={exclusiveTagFilter}
                onChange={(e) => setExclusiveTagFilter(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0 transition-colors"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 font-medium select-none transition-colors">
                Exigir correspondência exata das tags selecionadas
              </span>
            </label>
            <div className="group relative flex-shrink-0 ml-auto sm:ml-2">
              <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-600 dark:text-slate-300 cursor-help hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                ?
              </div>
              <div className="absolute left-1/2 sm:left-auto sm:right-full top-full sm:top-1/2 -translate-x-1/2 sm:-translate-x-0 sm:-translate-y-1/2 mt-2 sm:mt-0 sm:mr-2 w-64 p-3 bg-slate-900 dark:bg-slate-800 text-slate-100 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none border border-slate-700">
                Quando ativado, mostra apenas contatos que possuem{" "}
                <strong className="text-white">exatamente</strong> as tags selecionadas. Ideal para criar listas precisas para campanhas sem duplicatas.
              </div>
            </div>
          </div>
        )}

        {/* Badges de filtros ativos */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2">
            {search && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-300 shadow-sm transition-all">
                <Search className="h-3 w-3 flex-shrink-0 opacity-70" />
                <span className="truncate max-w-[200px]">"{search}"</span>
                <button
                  onClick={() => setSearch("")}
                  className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {selectedTags.length > 0 && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300 shadow-sm transition-all text-left">
                <Tag className="h-3 w-3 flex-shrink-0 opacity-70" />
                <span>
                  {selectedTags.length} tag{selectedTags.length !== 1 ? "s" : ""} selecionada{selectedTags.length !== 1 ? "s" : ""}
                </span>
                {exclusiveTagFilter && (
                  <span className="ml-1 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                    Exato
                  </span>
                )}
                <button
                  onClick={() => setSelectedTags([])}
                  className="ml-1 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
