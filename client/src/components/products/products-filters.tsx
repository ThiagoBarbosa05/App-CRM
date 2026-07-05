import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface ProductCategory {
  id: string;
  name: string;
}

interface ProductsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  countryFilter: string;
  setCountryFilter: (country: string) => void;
  volumeFilter: string;
  setVolumeFilter: (volume: string) => void;
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
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
  categoryFilter,
  setCategoryFilter,
}: ProductsFiltersProps) {
  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["/api/product-categories"],
    retry: 3,
    staleTime: 5 * 60 * 1000,
  });

  const { data: countries = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/tags/countries"],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-sm relative z-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <Input
            placeholder="Buscar por nome ou referência..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800/80 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 dark:focus-visible:border-blue-400 transition-all shadow-sm rounded-xl text-base"
          />
        </div>

        <Select value={typeFilter || "__all__"} onValueChange={(v) => setTypeFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800/80 shadow-sm text-sm font-medium">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os tipos</SelectItem>
            <SelectItem value="ESPUMANTE">🥂 Espumante</SelectItem>
            <SelectItem value="BRANCO">🥂 Branco</SelectItem>
            <SelectItem value="ROSE">🍷 Rose</SelectItem>
            <SelectItem value="TINTO">🍷 Tinto</SelectItem>
            <SelectItem value="PÓS-REFEIÇÃO">🥃 Pós-refeição</SelectItem>
          </SelectContent>
        </Select>

        <Select value={countryFilter || "__all__"} onValueChange={(v) => setCountryFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800/80 shadow-sm text-sm font-medium">
            <SelectValue placeholder="Todos os países" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os países</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c.id} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={volumeFilter || "__all__"} onValueChange={(v) => setVolumeFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800/80 shadow-sm text-sm font-medium">
            <SelectValue placeholder="Todos os volumes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os volumes</SelectItem>
            <SelectItem value="187ml">187ml</SelectItem>
            <SelectItem value="375ml">375ml</SelectItem>
            <SelectItem value="750ml">750ml</SelectItem>
            <SelectItem value="1500ml">1500ml</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter || "__all__"} onValueChange={(v) => setCategoryFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800/80 shadow-sm text-sm font-medium">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
