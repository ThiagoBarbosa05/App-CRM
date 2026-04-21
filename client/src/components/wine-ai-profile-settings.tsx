import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SETTING_KEY = "wine_ai_profile_instructions";

const AI_FIELDS = [
  { label: "Corpo", desc: "Leve / Médio / Encorpado", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { label: "Doçura", desc: "Seco / Meio-seco / Meio-doce / Doce", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  { label: "Acidez", desc: "Baixa / Média / Alta", color: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300" },
  { label: "Tanino", desc: "Baixo / Médio / Alto (apenas tintos)", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { label: "Mundo", desc: "Velho Mundo / Novo Mundo", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { label: "Região", desc: "Região vinícola específica", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { label: "Produtor", desc: "Vinícola inferida pelo nome", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  { label: "Uvas", desc: "Array com as castas principais", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" },
  { label: "Estilo", desc: "Clássico / Moderno / Natural / Orgânico / Biodinâmico", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  { label: "Harmonização", desc: "3–4 sugestões de harmonização", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { label: "Descrição", desc: "2–3 frases descrevendo o vinho", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
];

export function WineAIProfileSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [instructions, setInstructions] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const { isLoading, data: settingData } = useQuery<{ value: string | null }>({
    queryKey: ["/api/system-settings", SETTING_KEY],
    queryFn: async () => {
      const res = await fetch(`/api/system-settings/${SETTING_KEY}`);
      if (!res.ok) throw new Error("Erro ao buscar configuração");
      return res.json();
    },
  });

  useEffect(() => {
    if (settingData !== undefined) {
      setInstructions(settingData.value ?? "");
      setIsDirty(false);
    }
  }, [settingData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/system-settings/${SETTING_KEY}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: instructions,
          description: "Instruções customizadas para geração do perfil IA de vinhos",
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      return res.json();
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings", SETTING_KEY] });
      toast({ title: "Salvo", description: "Instruções da IA atualizadas com sucesso." });
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível salvar as instruções.", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Card: campos capturados */}
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Campos gerados pelo Perfil IA</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Informações que a IA extrai a partir do nome, tipo, país e categoria do produto.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AI_FIELDS.map((field) => (
              <div
                key={field.label}
                className="flex flex-col gap-0.5 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 min-w-[140px]"
              >
                <span className={`text-[11px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md w-fit ${field.color}`}>
                  {field.label}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{field.desc}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 text-xs text-blue-700 dark:text-blue-300">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              A IA recebe o <strong>nome</strong>, <strong>tipo</strong>, <strong>país</strong> e <strong>categoria</strong> do produto
              e infere os campos acima. Quanto mais detalhado o nome do produto, melhor o resultado.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card: instruções customizadas */}
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Orientações adicionais para a IA</CardTitle>
          <CardDescription className="text-xs">
            Adicione instruções extras que serão incluídas em todas as gerações de perfil IA de vinhos.
            Por exemplo: estilo de descrição, prioridades regionais, tom do texto, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={`Ex: "Priorize o contexto brasileiro ao descrever harmonizações. Use sempre linguagem acessível, evitando termos muito técnicos. Foque em vinhos do Novo Mundo quando o país não estiver claro."`}
            className="min-h-[140px] text-sm resize-none"
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              setIsDirty(true);
            }}
            disabled={isLoading}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {instructions.length > 0
                ? `${instructions.length} caracteres`
                : "Nenhuma instrução customizada definida"}
            </span>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending}
              className="gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
