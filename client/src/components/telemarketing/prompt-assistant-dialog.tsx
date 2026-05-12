import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Loader2, Sparkles, ClipboardCopy, Check, Wand2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromptAssistantDialogProps {
  open: boolean;
  onClose: () => void;
  agentName?: string;
  /** Callback chamado com o prompt gerado para preencher o campo */
  onApply: (prompt: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TONE_OPTIONS = [
  { value: "profissional e direto", label: "Profissional e direto" },
  { value: "amigável e empático", label: "Amigável e empático" },
  { value: "consultivo e educado", label: "Consultivo e educado" },
  {
    value: "entusiasta e persuasivo (vendas)",
    label: "Entusiasta e persuasivo (vendas)",
  },
  { value: "técnico e preciso", label: "Técnico e preciso" },
  { value: "formal e institucional", label: "Formal e institucional" },
  { value: "descontraído e próximo", label: "Descontraído e próximo" },
];

const LANGUAGE_OPTIONS = [
  { value: "Português do Brasil", label: "Português do Brasil" },
  { value: "Inglês", label: "Inglês" },
  { value: "Espanhol", label: "Espanhol" },
  { value: "Português de Portugal", label: "Português de Portugal" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PromptAssistantDialog({
  open,
  onClose,
  agentName,
  onApply,
}: PromptAssistantDialogProps) {
  const [purpose, setPurpose] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("profissional e direto");
  const [behaviors, setBehaviors] = useState("");
  const [language, setLanguage] = useState("Português do Brasil");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/elevenlabs/generate-system-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          audience,
          tone,
          behaviors,
          language,
          agentName,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Erro ao gerar prompt");
      }
      return res.json() as Promise<{ prompt: string }>;
    },
    onSuccess: (data) => {
      setGeneratedPrompt(data.prompt);
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao gerar prompt",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleCopy() {
    void navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleApply() {
    onApply(generatedPrompt);
    onClose();
    toast({ title: "Prompt aplicado com sucesso!" });
  }

  function handleClose() {
    onClose();
  }

  const canGenerate = purpose.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40">
              <Wand2 className="size-4 text-violet-600 dark:text-violet-400" />
            </div>
            Assistente de System Prompt
          </DialogTitle>
          <DialogDescription>
            Descreva como o agente deve se comportar e a IA gerará um system
            prompt completo e pronto para uso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Campos de entrada */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Objetivo principal do agente{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Ex: Realizar prospecção ativa para clientes que compraram há mais de 90 dias, apresentar novidades do catálogo e tentar agendar uma visita presencial."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Público-alvo</Label>
                <Input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Ex: Clientes B2B do setor varejista"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tom de voz</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Comportamentos e instruções específicas
              </Label>
              <Textarea
                value={behaviors}
                onChange={(e) => setBehaviors(e.target.value)}
                placeholder="Ex: Sempre se identificar como 'Assistente da Grand Cru'. Não revelar que é uma IA a menos que o cliente pergunte diretamente. Ao finalizar, perguntar se o cliente tem dúvidas. Nunca fazer promessas de desconto sem confirmação."
                rows={3}
                className="resize-none"
              />
            </div>

            <Button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={!canGenerate || generateMutation.isPending}
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {generateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {generateMutation.isPending
                ? "Gerando..."
                : "Gerar System Prompt"}
            </Button>
          </div>

          {/* Resultado */}
          {generatedPrompt && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Prompt gerado
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <ClipboardCopy className="size-3.5" />
                  )}
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
              <Textarea
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
                rows={14}
                className="font-mono text-xs resize-none bg-white dark:bg-slate-900"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Você pode editar o prompt acima antes de aplicar.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!generatedPrompt}
            className="gap-2"
            onClick={handleApply}
          >
            <Check className="size-4" />
            Usar este prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
