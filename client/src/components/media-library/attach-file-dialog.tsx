import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Search,
  ImageIcon,
  FileText,
  Video,
  Loader2,
  Check,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useMediaLibrary,
  useUploadMedia,
  useDeleteMedia,
  type MediaLibraryItem,
  type MediaType,
} from "@/hooks/use-media-library";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function TypeIcon({ type, className }: { type: MediaType; className?: string }) {
  if (type === "video") return <Video className={className} />;
  if (type === "document") return <FileText className={className} />;
  return <ImageIcon className={className} />;
}

interface AttachFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trava o filtro/uploads a um único tipo (ex.: cabeçalho de template). */
  lockedType?: MediaType;
  /** Atributo accept do input de upload (ex.: "image/*"). */
  accept?: string;
  onAttach: (item: MediaLibraryItem) => void;
}

export function AttachFileDialog({
  open,
  onOpenChange,
  lockedType,
  accept,
  onAttach,
}: AttachFileDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"biblioteca" | "novo">("biblioteca");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaType | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveType = lockedType ?? (typeFilter === "all" ? undefined : typeFilter);

  const { data: items = [], isLoading } = useMediaLibrary({
    type: effectiveType,
    search: debouncedSearch,
  });
  const uploadMedia = useUploadMedia();
  const deleteMedia = useDeleteMedia();

  // Reset ao abrir/fechar.
  useEffect(() => {
    if (open) {
      setTab("biblioteca");
      setSearch("");
      setDebouncedSearch("");
      setTypeFilter("all");
      setSelectedId(null);
    }
  }, [open]);

  // Debounce da busca.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const handleUpload = (file: File) => {
    if (lockedType) {
      const ok =
        (lockedType === "image" && file.type.startsWith("image/")) ||
        (lockedType === "video" && file.type.startsWith("video/")) ||
        (lockedType === "document" &&
          !file.type.startsWith("image/") &&
          !file.type.startsWith("video/"));
      if (!ok) {
        toast({
          title: `Selecione um arquivo do tipo ${lockedType}.`,
          variant: "destructive",
        });
        return;
      }
    }
    uploadMedia.mutate(
      { file },
      {
        onSuccess: (item) => {
          setTab("biblioteca");
          setSelectedId(item.id);
          toast({ title: "Mídia enviada para a biblioteca." });
        },
        onError: (err) => {
          toast({ title: err.message, variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMedia.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) setSelectedId(null);
      },
      onError: (err) => toast({ title: err.message, variant: "destructive" }),
    });
  };

  const handleAttach = () => {
    if (!selected) return;
    onAttach(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">Anexar arquivo</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <div className="px-5">
            <TabsList className="bg-transparent p-0 gap-4 h-auto border-b border-border w-full justify-start rounded-none">
              <TabsTrigger
                value="novo"
                className="rounded-none border-b-2 border-transparent px-0 pb-2 data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:text-primary"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Novo arquivo
              </TabsTrigger>
              <TabsTrigger
                value="biblioteca"
                className="rounded-none border-b-2 border-transparent px-0 pb-2 data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:text-primary"
              >
                <ImageIcon className="h-4 w-4 mr-1.5" />
                Biblioteca de mídia
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Aba: Novo arquivo ── */}
          <TabsContent value="novo" className="mt-0 px-5 py-5">
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploadMedia.isPending}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleUpload(file);
              }}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-12 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
            >
              {uploadMedia.isPending ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Upload className="h-7 w-7" />
              )}
              <span className="text-sm font-medium">
                {uploadMedia.isPending
                  ? "Enviando…"
                  : "Clique ou arraste um arquivo aqui"}
              </span>
              <span className="text-xs text-muted-foreground">Até 16 MB</span>
            </button>
          </TabsContent>

          {/* ── Aba: Biblioteca de mídia ── */}
          <TabsContent value="biblioteca" className="mt-0 px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar"
                  className="pl-8 h-9"
                />
              </div>
              {!lockedType && (
                <Select
                  value={typeFilter}
                  onValueChange={(v) => setTypeFilter(v as MediaType | "all")}
                >
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="h-72 overflow-y-auto -mx-1 px-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma mídia encontrada.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {items.map((item) => {
                    const isSelected = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "group relative flex flex-col rounded-lg border overflow-hidden text-left transition-colors",
                          isSelected
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                          {item.mediaType === "image" ? (
                            <img
                              src={item.url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <TypeIcon
                              type={item.mediaType}
                              className="h-8 w-8 text-muted-foreground"
                            />
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-[11px] font-medium truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatBytes(item.size)}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => handleDelete(item.id, e)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 text-white items-center justify-center opacity-0 group-hover:flex hover:bg-red-600 transition-colors hidden"
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="border-t border-border px-5 py-3">
          <Button
            className="w-full"
            disabled={!selected}
            onClick={handleAttach}
          >
            Anexar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
