import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface MarkerSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export default function MarkerSelect({ value, onChange, placeholder = "Selecionar marcadores..." }: MarkerSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: availableMarkers = [], isLoading, isError } = useQuery({
    queryKey: ["/api/markers"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/markers");
        if (!response.ok) throw new Error("Erro ao buscar marcadores");
        const markers = await response.json();
        // Retorna apenas os nomes dos marcadores
        return markers.map((marker: any) => marker.name);
      } catch (error) {
        console.error("Erro ao buscar marcadores:", error);
        return [];
      }
    },
  });

  const handleMarkerToggle = (marker: string) => {
    const isSelected = value.includes(marker);
    if (isSelected) {
      onChange(value.filter(m => m !== marker));
    } else {
      onChange([...value, marker]);
    }
    setOpen(false);
  };

  const handleRemoveMarker = (markerToRemove: string) => {
    onChange(value.filter(marker => marker !== markerToRemove));
  };

  const filteredMarkers = availableMarkers.filter((marker: string) =>
    marker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isError) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled
        >
          Erro ao carregar marcadores
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={isLoading}
          >
            {isLoading ? "Carregando..." : 
             value.length > 0 ? `${value.length} marcador(es) selecionado(s)` : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 p-2">
          <div className="mb-2">
            <Input
              placeholder="Buscar marcadores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredMarkers.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-2">
                  {searchTerm ? "Nenhum marcador encontrado." : "Nenhum marcador disponível."}
                </p>
                <p className="text-xs text-gray-400">
                  Crie marcadores na página de Configurações para utilizá-los aqui.
                </p>
              </div>
            ) : (
              <>
                {filteredMarkers.map((marker: string) => (
                  <DropdownMenuItem
                    key={marker}
                    onClick={() => handleMarkerToggle(marker)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value.includes(marker) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{marker}</span>
                    {value.includes(marker) && (
                      <span className="text-xs text-green-600">Selecionado</span>
                    )}
                  </DropdownMenuItem>
                ))}
                {filteredMarkers.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1">
                      <p className="text-xs text-gray-400 text-center">
                        Para adicionar novos marcadores, acesse a página Configurações
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((marker) => (
            <Badge
              key={marker}
              variant="secondary"
              className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100"
            >
              {marker}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0 hover:bg-blue-300 dark:hover:bg-blue-700 rounded-full"
                onClick={() => handleRemoveMarker(marker)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}