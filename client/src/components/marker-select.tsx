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
        console.log("🔄 Iniciando busca por marcadores...");
        const response = await fetch("/api/markers");
        console.log("📡 Response status:", response.status, response.statusText);
        
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        
        const markers = await response.json();
        console.log("📦 Marcadores recebidos da API:", markers);
        console.log("📊 Total de itens recebidos:", markers.length);
        
        // Mostrar todos os tipos recebidos
        const types = Array.from(new Set(markers.map((m: any) => m.type)));
        console.log("🏷️ Tipos encontrados:", types);
        
        // Filtra apenas marcadores do tipo 'marcador' e retorna os nomes
        const markersOnly = markers.filter((marker: any) => {
          console.log(`🔍 Verificando item: ${marker.name} (tipo: ${marker.type})`);
          return marker && marker.type === 'marcador';
        });
        
        console.log("✅ Marcadores filtrados por tipo:", markersOnly);
        
        const markerNames = markersOnly
          .map((marker: any) => marker.name)
          .filter((name: string) => name && typeof name === 'string' && name.trim().length > 0);
        
        console.log("🎯 Nomes dos marcadores finais:", markerNames);
        return markerNames;
      } catch (error) {
        console.error("❌ Erro ao buscar marcadores:", error);
        return [];
      }
    },
  });

  const handleMarkerToggle = (marker: string) => {
    if (!marker || typeof marker !== 'string') return;
    
    const currentValue = Array.isArray(value) ? value : [];
    const isSelected = currentValue.includes(marker);
    
    if (isSelected) {
      onChange(currentValue.filter(m => m !== marker));
    } else {
      onChange([...currentValue, marker]);
    }
    setOpen(false);
  };

  const handleRemoveMarker = (markerToRemove: string) => {
    const currentValue = Array.isArray(value) ? value : [];
    onChange(currentValue.filter(marker => marker !== markerToRemove));
  };

  // Debug do filtro
  console.log("🔍 Debug filtro - availableMarkers:", availableMarkers);
  console.log("🔍 Debug filtro - searchTerm:", searchTerm);
  
  const filteredMarkers = availableMarkers.filter((marker: string) => {
    const isValid = marker && typeof marker === 'string';
    const matchesSearch = searchTerm === "" || marker.toLowerCase().includes(searchTerm.toLowerCase());
    console.log(`🔍 Filtro marcador "${marker}": válido=${isValid}, busca="${searchTerm}", match=${matchesSearch}`);
    return isValid && matchesSearch;
  });
  
  console.log("🎯 Marcadores filtrados final:", filteredMarkers);

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
             value && Array.isArray(value) && value.length > 0 ? `${value.length} marcador(es) selecionado(s)` : placeholder}
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
            {/* Debug info */}
            <div className="text-xs text-gray-500 p-2 border-b bg-yellow-50">
              <div>🐛 DEBUG: {availableMarkers.length} marcadores carregados</div>
              <div>📊 Estado: {isLoading ? "carregando..." : isError ? "erro" : "sucesso"}</div>
              <div>🔍 Filtrados: {filteredMarkers.length}</div>
              <div>🔤 Busca: "{searchTerm}"</div>
              {availableMarkers.length > 0 && (
                <div className="mt-1">📝 Lista: {availableMarkers.slice(0, 3).join(", ")}{availableMarkers.length > 3 ? "..." : ""}</div>
              )}
            </div>
            
            {filteredMarkers.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-2">
                  {isLoading ? "Carregando marcadores..." : 
                   searchTerm ? "Nenhum marcador encontrado." : 
                   availableMarkers.length === 0 ? "Nenhum marcador disponível." : "Nenhum resultado para a busca."}
                </p>
                {!isLoading && availableMarkers.length === 0 && (
                  <p className="text-xs text-gray-400">
                    Crie marcadores na página de Configurações para utilizá-los aqui.
                  </p>
                )}
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
                        value && Array.isArray(value) && value.includes(marker) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{marker}</span>
                    {value && Array.isArray(value) && value.includes(marker) && (
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

      {value && Array.isArray(value) && value.length > 0 && (
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