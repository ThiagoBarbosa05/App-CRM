import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
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

interface Tag {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
}

interface UmblerTagSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export default function UmblerTagSelect({
  value,
  onChange,
  placeholder = "Selecionar tags...",
}: UmblerTagSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: tagsResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["/api/umbler/tags"],
    queryFn: async () => {
      const response = await fetch("/api/umbler/tags");
      if (!response.ok) throw new Error("Erro ao buscar tags");
      return response.json();
    },
  });

  const availableTags: Tag[] = tagsResponse?.items || [];

  const handleTagToggle = (tagId: string) => {
    if (!tagId) return;

    const currentValue = Array.isArray(value) ? value : [];
    const isSelected = currentValue.includes(tagId);

    if (isSelected) {
      onChange(currentValue.filter((id) => id !== tagId));
    } else {
      onChange([...currentValue, tagId]);
    }
    setOpen(false);
  };

  const handleRemoveTag = (tagIdToRemove: string) => {
    const currentValue = Array.isArray(value) ? value : [];
    onChange(currentValue.filter((id) => id !== tagIdToRemove));
  };

  const filteredTags = availableTags.filter((tag: Tag) => {
    if (!searchTerm) return true;
    return tag.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getTagById = (id: string) => {
    return availableTags.find((tag) => tag.id === id);
  };

  if (isError) {
    return (
      <div className="space-y-2">
        <Button variant="outline" className="w-full justify-between" disabled>
          Erro ao carregar tags
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
            {isLoading
              ? "Carregando..."
              : value && Array.isArray(value) && value.length > 0
              ? `${value.length} tag(s) selecionada(s)`
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 p-2">
          <div className="mb-2">
            <Input
              placeholder="Buscar tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredTags.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-2">
                  {isLoading
                    ? "Carregando tags..."
                    : searchTerm
                    ? "Nenhuma tag encontrada."
                    : "Nenhuma tag disponível."}
                </p>
              </div>
            ) : (
              <>
                {filteredTags.map((tag: Tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value && Array.isArray(value) && value.includes(tag.id)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <span className="flex-1 flex items-center gap-1">
                      {tag.emoji && <span>{tag.emoji}</span>}
                      {tag.name}
                    </span>
                    {value &&
                      Array.isArray(value) &&
                      value.includes(tag.id) && (
                        <span className="text-xs text-green-600">
                          Selecionada
                        </span>
                      )}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {value && Array.isArray(value) && value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tagId) => {
            const tag = getTagById(tagId);
            if (!tag) return null;

            return (
              <Badge
                key={tagId}
                variant="secondary"
                className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100"
              >
                {tag.emoji && <span className="mr-1">{tag.emoji}</span>}
                {tag.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-4 w-4 p-0 hover:bg-blue-300 dark:hover:bg-blue-700 rounded-full"
                  onClick={() => handleRemoveTag(tagId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
