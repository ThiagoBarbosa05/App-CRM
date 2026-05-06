import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const agentSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  prompt: z.string().min(1, "Prompt é obrigatório"),
  firstMessage: z.string().min(1, "Primeira mensagem é obrigatória"),
  language: z.string().min(1),
  voiceId: z.string().optional(),
  llm: z.string().min(1),
});
type AgentForm = z.infer<typeof agentSchema>;

type AgentConfig = {
  agentId: string;
  name: string;
  prompt: string;
  firstMessage: string;
  language: string;
  voiceId: string;
  llm: string;
};

const LANGUAGES = [
  { value: "pt-br", label: "Português (Brasil)" },
  { value: "pt", label: "Português (Portugal)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
];

const LLM_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (multilíngue, recomendado)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (multilíngue, rápido)" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4 (multilíngue)" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (multilíngue, rápido)" },
  { value: "gpt-4.1", label: "GPT-4.1 (inglês)" },
  { value: "gpt-4o", label: "GPT-4o (inglês)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (inglês)" },
];

interface AgentConfigModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
  campaignName: string;
}

export function AgentConfigModal({
  open,
  onClose,
  agentId,
  campaignName,
}: AgentConfigModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AgentForm>({ resolver: zodResolver(agentSchema) });

  const { data: config, isLoading } = useQuery<AgentConfig>({
    queryKey: ["/api/elevenlabs/agents", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar agente");
      return res.json();
    },
    enabled: open && !!agentId,
  });

  useEffect(() => {
    if (config) {
      reset({
        name: config.name,
        prompt: config.prompt,
        firstMessage: config.firstMessage,
        language: config.language || "pt-br",
        voiceId: config.voiceId ?? "",
        llm: config.llm || "gemini-2.5-flash",
      });
    }
  }, [config, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: AgentForm) => {
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao salvar");
      }
    },
    onSuccess: () => {
      toast({ title: "Agente atualizado com sucesso" });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const language = watch("language");
  const llm = watch("llm");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            Configurar Agente IA — {campaignName}
          </SheetTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
            {agentId}
          </p>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
            className="space-y-5 mt-6"
          >
            <div className="space-y-1.5">
              <Label className="text-sm">Nome do agente</Label>
              <Input {...register("name")} placeholder="Ex: Agente de vendas" />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Primeira mensagem</Label>
              <Input
                {...register("firstMessage")}
                placeholder="Ex: Olá, posso te ajudar?"
              />
              {errors.firstMessage && (
                <p className="text-xs text-red-500">{errors.firstMessage.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Idioma</Label>
              <Select
                value={language}
                onValueChange={(v) => setValue("language", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Voice ID (opcional)</Label>
              <Input
                {...register("voiceId")}
                placeholder="Deixe em branco para usar a voz padrão do agente"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Modelo LLM</Label>
              <Select value={llm} onValueChange={(v) => setValue("llm", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Para Português e outros idiomas não-ingleses use <strong>Gemini</strong> ou <strong>Claude</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">System Prompt</Label>
              <Textarea
                {...register("prompt")}
                placeholder="Instruções de comportamento do agente..."
                rows={10}
                className="font-mono text-xs"
              />
              {errors.prompt && (
                <p className="text-xs text-red-500">{errors.prompt.message}</p>
              )}
            </div>

            <SheetFooter className="pt-2">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Salvar
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
