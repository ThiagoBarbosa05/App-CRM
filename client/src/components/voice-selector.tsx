import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mic, Play, Square, ChevronDown, Search, X } from "lucide-react";

type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
};

interface VoiceSelectorProps {
  value?: string;
  onChange: (voiceId: string) => void;
  placeholder?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  premade: "Padrão",
  cloned: "Clonada",
  generated: "Gerada",
  professional: "Profissional",
};

const CATEGORY_COLOR: Record<string, string> = {
  premade: "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  cloned: "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-400",
  generated: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
  professional: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function VoiceSelector({
  value,
  onChange,
  placeholder = "Selecionar voz",
}: VoiceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading, isFetching, isError } = useQuery<{ voices: ElevenLabsVoice[] }>({
    queryKey: ["/api/elevenlabs/voices", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/elevenlabs/voices?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar vozes");
      return res.json();
    },
    enabled: open,
    staleTime: 2 * 60 * 1000,
  });

  const voices = data?.voices ?? [];

  // Para exibir o nome da voz selecionada no botão, buscamos sem filtro
  const { data: allData } = useQuery<{ voices: ElevenLabsVoice[] }>({
    queryKey: ["/api/elevenlabs/voices", ""],
    queryFn: async () => {
      const res = await fetch("/api/elevenlabs/voices", { credentials: "include" });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!value,
    staleTime: 5 * 60 * 1000,
  });

  const selectedVoice =
    (allData?.voices ?? voices).find((v) => v.voice_id === value) ??
    voices.find((v) => v.voice_id === value);

  function handleClose() {
    stopAudio();
    setSearch("");
    setOpen(false);
  }

  function handleSelect(voice: ElevenLabsVoice) {
    stopAudio();
    onChange(voice.voice_id);
    handleClose();
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }

  function togglePreview(voice: ElevenLabsVoice, e: React.MouseEvent) {
    e.stopPropagation();
    if (!voice.preview_url) return;
    if (playingId === voice.voice_id) {
      stopAudio();
      return;
    }
    stopAudio();
    const audio = new Audio(voice.preview_url);
    audioRef.current = audio;
    setPlayingId(voice.voice_id);
    audio.play().catch(() => setPlayingId(null));
    audio.onended = () => setPlayingId(null);
  }

  function getGenderLabel(labels: Record<string, string>) {
    const gender = labels["gender"] ?? labels["Gender"];
    if (!gender) return null;
    if (gender === "female") return "Feminino";
    if (gender === "male") return "Masculino";
    return gender;
  }

  function getAccentLabel(labels: Record<string, string>) {
    return labels["accent"] ?? labels["Accent"] ?? null;
  }

  const showSpinner = isLoading || (isFetching && voices.length === 0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal text-sm h-9 px-3"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Mic className="size-3.5 shrink-0 text-slate-400" />
          <span className={`truncate ${selectedVoice ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
            {selectedVoice ? selectedVoice.name : placeholder}
          </span>
          {selectedVoice && (
            <Badge
              variant="outline"
              className={`text-[10px] shrink-0 ${CATEGORY_COLOR[selectedVoice.category] ?? ""}`}
            >
              {CATEGORY_LABEL[selectedVoice.category] ?? selectedVoice.category}
            </Badge>
          )}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-slate-400 ml-2" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : setOpen(true))}>
        <DialogContent className="w-full max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mic className="size-4 text-violet-500" />
              Selecionar Voz
              <span className="ml-auto text-xs font-normal text-slate-400">
                {!isLoading && !isFetching && `${voices.length} voz${voices.length !== 1 ? "es" : ""}`}
                {isFetching && <Loader2 className="size-3 animate-spin inline ml-1" />}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Barra de busca */}
          <div className="px-6 py-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Buscar voz por nome ou categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cabeçalho da tabela */}
          {!isLoading && voices.length > 0 && (
            <div className="px-6 pb-2 shrink-0">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span>Nome</span>
                <span>Tipo</span>
                <span>Gênero</span>
                <span>Sotaque</span>
                <span className="w-36 text-center">Ações</span>
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
            {showSpinner && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="size-6 animate-spin text-violet-500" />
                <p className="text-sm text-slate-400">
                  {debouncedSearch ? "Buscando na API..." : "Carregando vozes..."}
                </p>
              </div>
            )}

            {isError && (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-red-500">
                  Erro ao carregar vozes. Verifique a API Key do ElevenLabs.
                </p>
              </div>
            )}

            {!showSpinner && !isError && voices.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Mic className="size-8 text-slate-300" />
                <p className="text-sm text-slate-400">
                  {debouncedSearch ? `Nenhuma voz encontrada para "${debouncedSearch}"` : "Nenhuma voz disponível"}
                </p>
              </div>
            )}

            {!showSpinner && !isError && voices.length > 0 && (
              <div className="space-y-1.5">
                {voices.map((voice) => {
                  const isSelected = voice.voice_id === value;
                  const isPlaying = playingId === voice.voice_id;
                  const gender = getGenderLabel(voice.labels);
                  const accent = getAccentLabel(voice.labels);

                  return (
                    <div
                      key={voice.voice_id}
                      onClick={() => handleSelect(voice)}
                      className={`grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3.5 rounded-xl border cursor-pointer transition-all duration-150
                        ${isSelected
                          ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-900/20 shadow-sm"
                          : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm"
                        }`}
                    >
                      {/* Nome */}
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate leading-tight ${isSelected ? "text-violet-700 dark:text-violet-300" : "text-slate-800 dark:text-slate-100"}`}>
                          {voice.name}
                        </p>
                        {isSelected && (
                          <p className="text-[10px] text-violet-500 mt-0.5">Selecionada</p>
                        )}
                      </div>

                      {/* Tipo */}
                      <div>
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium ${CATEGORY_COLOR[voice.category] ?? "border-slate-200 text-slate-500"}`}
                        >
                          {CATEGORY_LABEL[voice.category] ?? voice.category}
                        </Badge>
                      </div>

                      {/* Gênero */}
                      <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {gender ?? "—"}
                      </span>

                      {/* Sotaque */}
                      <span className="text-sm text-slate-500 dark:text-slate-400 truncate capitalize">
                        {accent ?? "—"}
                      </span>

                      {/* Ações */}
                      <div className="flex items-center gap-2 w-36 justify-end" onClick={(e) => e.stopPropagation()}>
                        {voice.preview_url ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`h-8 gap-1.5 text-xs rounded-lg px-3 transition-colors ${
                              isPlaying
                                ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300 hover:text-violet-600"
                            }`}
                            onClick={(e) => togglePreview(voice, e)}
                          >
                            {isPlaying ? (
                              <>
                                <Square className="size-3 fill-current" />
                                Parar
                              </>
                            ) : (
                              <>
                                <Play className="size-3 fill-current" />
                                Ouvir
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600 w-[68px] text-center">sem preview</span>
                        )}

                        <Button
                          type="button"
                          size="sm"
                          className={`h-8 text-xs rounded-lg px-3 shrink-0 ${
                            isSelected
                              ? "bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                              : "bg-slate-100 hover:bg-violet-600 hover:text-white text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-violet-600"
                          }`}
                          onClick={() => handleSelect(voice)}
                        >
                          {isSelected ? "✓ Usar" : "Usar"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
