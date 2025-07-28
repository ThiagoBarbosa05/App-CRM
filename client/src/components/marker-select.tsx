import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
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

interface MarkerSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export default function MarkerSelect({ value, onChange, placeholder = "Selecionar marcadores..." }: MarkerSelectProps) {
  const [open, setOpen] = useState(false);

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

  const handleRemoveMarker = (markerToRemove: string) => {
    onChange(value.filter(marker => marker !== markerToRemove));
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
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-2">Nenhum marcador encontrado.</p>
                  <p className="text-xs text-gray-400">
                    Crie marcadores na página de Configurações para utilizá-los aqui.
                  </p>
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
                    <p className="text-xs text-gray-400 px-2 text-center">
                      Para adicionar novos marcadores, acesse a página Configurações
                    </p>
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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