import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { Label } from "@/components/ui/label";

interface ClientFiltersProps {
  onFiltersChange: (filters: ClientFilters) => void;
  currentFilters: ClientFilters;
}

export interface ClientFilters {
  name: string;
  phone: string;
  cpf: string;
  responsavelId: string;
  categoria: string;
  origem: string;
  markers: string;
}

export default function ClientFilters({ onFiltersChange, currentFilters }: ClientFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ClientFilters>(currentFilters);
  const [isOpen, setIsOpen] = useState(false);

  // Buscar usuários para o dropdown
  const { data: users = [] } = useQuery<{id: string; name: string; email: string}[]>({
    queryKey: ["/api/users"],
  });

  const handleFilterChange = (key: keyof ClientFilters, value: string) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const clearFilters = () => {
    const emptyFilters: ClientFilters = {
      name: "",
      phone: "",
      cpf: "",
      responsavelId: "",
      categoria: "",
      origem: "",
      markers: "",
    };
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    setIsOpen(false);
  };

  const hasActiveFilters = Object.values(currentFilters).some(value => value !== "");

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={hasActiveFilters ? "bg-blue-50 border-blue-200" : ""}>
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {hasActiveFilters && (
            <span className="ml-2 bg-blue-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
              {Object.values(currentFilters).filter(value => value !== "").length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filtros Avançados</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="filter-name" className="text-sm font-medium">
                Nome
              </Label>
              <Input
                id="filter-name"
                placeholder="Filtrar por nome..."
                value={localFilters.name}
                onChange={(e) => handleFilterChange("name", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="filter-phone" className="text-sm font-medium">
                Telefone
              </Label>
              <Input
                id="filter-phone"
                placeholder="Filtrar por telefone..."
                value={localFilters.phone}
                onChange={(e) => handleFilterChange("phone", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="filter-cpf" className="text-sm font-medium">
                CPF
              </Label>
              <Input
                id="filter-cpf"
                placeholder="Filtrar por CPF..."
                value={localFilters.cpf}
                onChange={(e) => handleFilterChange("cpf", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="filter-responsible" className="text-sm font-medium">
                Usuário Responsável
              </Label>
              <Select 
                value={localFilters.responsavelId} 
                onValueChange={(value) => handleFilterChange("responsavelId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os usuários</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-categoria" className="text-sm font-medium">
                Categoria
              </Label>
              <Input
                id="filter-categoria"
                placeholder="Filtrar por categoria..."
                value={localFilters.categoria}
                onChange={(e) => handleFilterChange("categoria", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="filter-origem" className="text-sm font-medium">
                Origem
              </Label>
              <Input
                id="filter-origem"
                placeholder="Filtrar por origem..."
                value={localFilters.origem}
                onChange={(e) => handleFilterChange("origem", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="filter-markers" className="text-sm font-medium">
                Marcadores
              </Label>
              <Input
                id="filter-markers"
                placeholder="Filtrar por marcadores..."
                value={localFilters.markers}
                onChange={(e) => handleFilterChange("markers", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={applyFilters} className="flex-1">
              Aplicar Filtros
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Limpar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}