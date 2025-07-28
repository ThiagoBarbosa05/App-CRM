import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface MarkerSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export default function MarkerSelect({ value, onChange, placeholder = "Selecionar marcadores..." }: MarkerSelectProps) {
  const [open, setOpen] = useState(false);
  const [showNewMarkerForm, setShowNewMarkerForm] = useState(false);
  const [newMarkerName, setNewMarkerName] = useState("");

  const { data: availableMarkers = [] } = useQuery({
    queryKey: ["/api/markers"],
    queryFn: async () => {
      const response = await fetch("/api/markers");
      if (!response.ok) throw new Error("Erro ao buscar marcadores");
      const markers = await response.json();
      // Retorna apenas os nomes dos marcadores
      return markers.map((marker: any) => marker.name);
    },
  });

  const handleMarkerToggle = (marker: string) => {
    const isSelected = value.includes(marker);
    if (isSelected) {
      onChange(value.filter(m => m !== marker));
    } else {
      onChange([...value, marker]);
    }
  };

  const handleAddNewMarker = () => {
    const trimmedName = newMarkerName.trim();
    if (trimmedName && !value.includes(trimmedName)) {
      // Adicionar ao estado local imediatamente para melhor UX
      onChange([...value, trimmedName]);
      setNewMarkerName("");
      setShowNewMarkerForm(false);
      
      // Mostrar aviso de que o marcador deve ser criado nas configurações
      // para ficar disponível permanentemente
    }
  };

  const handleRemoveMarker = (markerToRemove: string) => {
    onChange(value.filter(marker => marker !== markerToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddNewMarker();
    }
    if (e.key === "Escape") {
      setShowNewMarkerForm(false);
      setNewMarkerName("");
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value.length > 0 ? `${value.length} marcador(es) selecionado(s)` : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Buscar marcadores..." />
            <CommandList>
              <CommandEmpty>
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500 mb-2">Nenhum marcador encontrado.</p>
                  <p className="text-xs text-gray-400 mb-2">
                    Crie marcadores permanentes na página de Configurações
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewMarkerForm(true)}
                    className="text-primary"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar temporário
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {availableMarkers.map((marker: string) => (
                  <CommandItem
                    key={marker}
                    value={marker}
                    onSelect={() => handleMarkerToggle(marker)}
                    disabled={value.includes(marker)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(marker) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {marker}
                    {value.includes(marker) && (
                      <span className="ml-auto text-xs text-green-600">Selecionado</span>
                    )}
                  </CommandItem>
                ))}
                {availableMarkers.length > 0 && (
                  <div className="border-t pt-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewMarkerForm(true)}
                      className="w-full text-primary justify-start"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar temporário
                    </Button>
                    <p className="text-xs text-gray-400 px-2 mt-1">
                      Para marcadores permanentes, use Configurações
                    </p>
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showNewMarkerForm && (
        <div className="p-3 border rounded-md bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <Input
              placeholder="Nome do marcador temporário"
              value={newMarkerName}
              onChange={(e) => setNewMarkerName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              autoFocus
            />
            <Button size="sm" onClick={handleAddNewMarker} disabled={!newMarkerName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowNewMarkerForm(false);
                setNewMarkerName("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-yellow-700">
            ⚠️ Este marcador será temporário. Para criar marcadores permanentes, acesse a página Configurações.
          </p>
        </div>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((marker) => (
            <Badge
              key={marker}
              variant="secondary"
              className="bg-blue-100 text-blue-800 hover:bg-blue-200"
            >
              {marker}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0 hover:bg-blue-300 rounded-full"
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