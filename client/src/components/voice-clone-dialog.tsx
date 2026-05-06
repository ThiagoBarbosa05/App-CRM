import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Upload,
  Loader2,
  Plus,
  CheckCircle2,
  Copy,
  MicOff,
  AlertTriangle,
} from "lucide-react";

interface AudioSample {
  id: string;
  blob: Blob;
  name: string;
  durationSec: number;
  url: string;
}

interface VoiceCloneDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (voiceId: string, voiceName: string) => void;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SampleRow({
  sample,
  onRemove,
}: {
  sample: AudioSample;
  onRemove: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggle() {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      const audio = new Audio(sample.url);
      audioRef.current = audio;
      setPlaying(true);
      audio.play();
      audio.onended = () => setPlaying(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg shrink-0 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
        onClick={toggle}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
          {sample.name}
        </p>
        <p className="text-xs text-slate-400">{formatDuration(sample.durationSec)}</p>
      </div>

      <Badge variant="outline" className="text-xs border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 shrink-0">
        {(sample.blob.size / 1024).toFixed(0)} KB
      </Badge>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function RecordTab({
  samples,
  onAdd,
}: {
  samples: AudioSample[];
  onAdd: (sample: AudioSample) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];
      mediaRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const durationSec = (Date.now() - startTimeRef.current) / 1000;
        const url = URL.createObjectURL(blob);
        const count = samples.length + 1;
        onAdd({ id: crypto.randomUUID(), blob, name: `Gravação ${count}`, durationSec, url });
      };

      recorder.start(250);
      startTimeRef.current = Date.now();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch {
      setError("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  }, [samples.length, onAdd]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    setRecording(false);
    setElapsed(0);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 py-6 rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-900/10">
        {recording ? (
          <>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums">
                Gravando — {formatDuration(elapsed)}
              </span>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={stopRecording}
              className="gap-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white px-8"
            >
              <Square className="size-4 fill-current" />
              Parar gravação
            </Button>
          </>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-500">
              <Mic className="size-8" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Clique para gravar uma amostra de voz
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Recomendado: 15–60 segundos por amostra. Fale de forma natural.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={startRecording}
              className="gap-2 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white px-8"
            >
              <Mic className="size-4" />
              Iniciar gravação
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-3 py-2.5">
          <MicOff className="size-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

function UploadTab({ onAdd }: { onAdd: (sample: AudioSample) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function processFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("audio/")) return;
      const url = URL.createObjectURL(file);
      // Estima duração via Audio element
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        onAdd({
          id: crypto.randomUUID(),
          blob: file,
          name: file.name,
          durationSec: audio.duration,
          url,
        });
      });
    });
  }

  return (
    <div
      className={`flex flex-col items-center gap-4 py-8 rounded-2xl border-2 border-dashed transition-colors cursor-pointer
        ${dragging
          ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20"
          : "border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20 hover:border-violet-300 dark:hover:border-violet-700"
        }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => processFiles(e.target.files)}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
        <Upload className="size-6" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Arraste arquivos ou clique para selecionar
        </p>
        <p className="text-xs text-slate-400 mt-1">
          MP3, WAV, OGG, OPUS, WEBM — máx. 25 MB por arquivo
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" className="gap-2 rounded-xl pointer-events-none">
        <Plus className="size-3.5" />
        Selecionar arquivos
      </Button>
    </div>
  );
}

export function VoiceCloneDialog({ open, onClose, onCreated }: VoiceCloneDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [samples, setSamples] = useState<AudioSample[]>([]);
  const [createdVoiceId, setCreatedVoiceId] = useState<string | null>(null);

  function addSample(sample: AudioSample) {
    setSamples((prev) => [...prev, sample]);
  }

  function removeSample(id: string) {
    setSamples((prev) => {
      const removed = prev.find((s) => s.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((s) => s.id !== id);
    });
  }

  function handleClose() {
    samples.forEach((s) => URL.revokeObjectURL(s.url));
    setSamples([]);
    setName("");
    setDescription("");
    setCreatedVoiceId(null);
    onClose();
  }

  const cloneMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("name", name.trim());
      if (description.trim()) form.append("description", description.trim());
      for (const sample of samples) {
        const ext = sample.blob.type.includes("webm") ? "webm" : sample.blob.type.includes("wav") ? "wav" : "mp3";
        form.append("files", sample.blob, sample.name.endsWith(`.${ext}`) ? sample.name : `${sample.name}.${ext}`);
      }
      const res = await fetch("/api/elevenlabs/voices", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao criar voz");
      }
      return res.json() as Promise<{ voiceId: string }>;
    },
    onSuccess: (data) => {
      setCreatedVoiceId(data.voiceId);
      queryClient.invalidateQueries({ queryKey: ["/api/elevenlabs/voices"] });
      onCreated?.(data.voiceId, name.trim());
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao clonar voz", description: err.message, variant: "destructive" }),
  });

  const totalDuration = samples.reduce((acc, s) => acc + s.durationSec, 0);
  const canSubmit = name.trim().length >= 3 && samples.length > 0 && !cloneMutation.isPending;

  if (createdVoiceId) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-500" />
              Voz criada com sucesso!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sua voz <strong>"{name}"</strong> foi cadastrada no ElevenLabs. Use o ID abaixo para vinculá-la a um agente.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Voice ID</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={createdVoiceId}
                  className="font-mono text-sm bg-slate-50 dark:bg-slate-800/60"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(createdVoiceId);
                    toast({ title: "ID copiado!" });
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20 px-3 py-2.5">
              <p className="text-xs text-violet-700 dark:text-violet-300">
                A voz já está disponível no seletor de vozes dos agentes. Ela pode demorar alguns instantes para processar completamente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose} className="bg-violet-600 hover:bg-violet-700 text-white">
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Mic className="size-5 text-violet-500" />
            Clonar voz
          </DialogTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Grave ou envie amostras de áudio para criar uma voz personalizada no ElevenLabs.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5 min-h-0">
          {/* Dados da voz */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Nome da voz *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Minha Voz de Vendas"
                maxLength={100}
              />
              {name.length > 0 && name.trim().length < 3 && (
                <p className="text-xs text-red-500">Mínimo 3 caracteres</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Descrição (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Voz masculina, tom amigável e profissional..."
                rows={2}
              />
            </div>
          </div>

          {/* Amostras de áudio */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Amostras de áudio *</Label>
              {samples.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-slate-500">
                    {samples.length} amostra{samples.length > 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${totalDuration >= 15 ? "border-emerald-200 text-emerald-600" : "border-amber-200 text-amber-600"}`}>
                    {formatDuration(totalDuration)} total
                  </Badge>
                </div>
              )}
            </div>

            <Tabs defaultValue="record">
              <TabsList className="w-full rounded-xl">
                <TabsTrigger value="record" className="flex-1 gap-1.5 rounded-lg">
                  <Mic className="size-3.5" />
                  Gravar
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1 gap-1.5 rounded-lg">
                  <Upload className="size-3.5" />
                  Upload
                </TabsTrigger>
              </TabsList>
              <TabsContent value="record" className="mt-3">
                <RecordTab samples={samples} onAdd={addSample} />
              </TabsContent>
              <TabsContent value="upload" className="mt-3">
                <UploadTab onAdd={addSample} />
              </TabsContent>
            </Tabs>

            {/* Lista de amostras */}
            {samples.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Amostras adicionadas
                </p>
                {samples.map((s) => (
                  <SampleRow key={s.id} sample={s} onRemove={() => removeSample(s.id)} />
                ))}
              </div>
            )}

            {/* Dica */}
            {totalDuration > 0 && totalDuration < 15 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3 py-2.5">
                <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Recomendamos ao menos 15 segundos de áudio para melhor qualidade. Adicione mais amostras.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={cloneMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => cloneMutation.mutate()}
            disabled={!canSubmit}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white min-w-[140px]"
          >
            {cloneMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Criando voz...
              </>
            ) : (
              <>
                <Mic className="size-4" />
                Criar voz clonada
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
