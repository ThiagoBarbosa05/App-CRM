import { useMutation } from "@tanstack/react-query";
import { Sparkles, RefreshCw, Wine, Grape, MapPin, Lightbulb, Banknote, Quote, ChartPie } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { useTheme } from "@/contexts/theme-context";

interface WineTypeShare {
  tipo: string;
  quantidade: number;
  percentual: number;
}

interface WineProfile {
  resumo: string;
  tipos_preferidos: string[];
  perfil_sensorial: {
    corpo: string;
    docura: string;
    tanino: string | null;
  };
  regioes_favoritas: string[];
  uvas_favoritas: string[];
  faixa_de_preco: { min: number; max: number };
  sugestao_abordagem: string;
  distribuicao_tipos?: WineTypeShare[];
}

interface ClientProp {
  id: string;
  name: string;
  wineProfile?: unknown;
  wineProfileGeneratedAt?: Date | string | null;
}

interface SensoryScale {
  label: string;
  value: string;
  levels: string[];
  activeIndex: number;
  gradient: string;
}

function normalize(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function buildScale(label: string, value: string | null | undefined, levels: string[], gradient: string): SensoryScale | null {
  if (!value) return null;
  const idx = levels.findIndex((l) => normalize(l) === normalize(value));
  return {
    label,
    value,
    levels,
    activeIndex: idx,
    gradient,
  };
}

// Paleta fixa por tipo de vinho, validada para daltonismo nos dois temas
const WINE_TYPE_COLORS: Record<string, { light: string; dark: string }> = {
  TINTO: { light: "#d03b3b", dark: "#e66767" },
  BRANCO: { light: "#eda100", dark: "#c98500" },
  ROSE: { light: "#e87ba4", dark: "#d55181" },
  ESPUMANTE: { light: "#1baf7a", dark: "#199e70" },
  "PÓS-REFEIÇÃO": { light: "#4a3aa7", dark: "#9085e9" },
  OUTROS: { light: "#898781", dark: "#898781" },
};

function wineTypeColor(tipo: string, isDark: boolean): string {
  const entry = WINE_TYPE_COLORS[tipo.toUpperCase()] ?? WINE_TYPE_COLORS.OUTROS;
  return isDark ? entry.dark : entry.light;
}

function formatWineTypeLabel(tipo: string): string {
  return tipo.charAt(0) + tipo.slice(1).toLowerCase();
}

function WineTypeDonut({ data }: { data: WineTypeShare[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sorted = [...data].sort((a, b) => b.quantidade - a.quantidade);
  const top = sorted[0];
  const surfaceStroke = isDark ? "#1e293b" : "#ffffff";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sorted}
              dataKey="quantidade"
              nameKey="tipo"
              innerRadius="62%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke={surfaceStroke}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {sorted.map((item) => (
                <Cell key={item.tipo} fill={wineTypeColor(item.tipo, isDark)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload as WineTypeShare;
                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3 py-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {formatWineTypeLabel(item.tipo)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {item.percentual.toLocaleString("pt-BR")}% · {item.quantidade.toLocaleString("pt-BR")}{" "}
                      {item.quantidade === 1 ? "garrafa" : "garrafas"}
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centro do donut: tipo dominante */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xl font-extrabold text-slate-800 dark:text-slate-200 tabular-nums leading-none">
            {Math.round(top.percentual)}%
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            {formatWineTypeLabel(top.tipo)}
          </p>
        </div>
      </div>

      {/* Legenda com valores — identidade nunca depende só da cor */}
      <div className="flex-1 w-full space-y-2">
        {sorted.map((item) => (
          <div key={item.tipo} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: wineTypeColor(item.tipo, isDark) }}
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex-1 truncate">
              {formatWineTypeLabel(item.tipo)}
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
              {item.percentual.toLocaleString("pt-BR")}%
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums w-16 text-right">
              {item.quantidade.toLocaleString("pt-BR")} gf.
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SensoryScaleRow({ scale }: { scale: SensoryScale }) {
  const filled = scale.activeIndex >= 0 ? scale.activeIndex + 1 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{scale.label}</p>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{scale.value}</p>
      </div>
      <div className="flex gap-1">
        {scale.levels.map((level, i) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < filled ? scale.gradient : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-slate-400 capitalize">{scale.levels[0]}</span>
        <span className="text-[9px] text-slate-400 capitalize">{scale.levels[scale.levels.length - 1]}</span>
      </div>
    </div>
  );
}

export function ClientWineProfileTab({ client }: { client: ClientProp }) {
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${client.id}/generate-wine-profile`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao gerar perfil");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id] });
      toast({ title: "Perfil atualizado", description: "O perfil de gosto foi gerado com sucesso." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const profile = (client.wineProfile as WineProfile) ?? null;

  const scales = profile
    ? [
        buildScale("Corpo", profile.perfil_sensorial?.corpo, ["leve", "médio", "encorpado"], "bg-gradient-to-r from-amber-400 to-amber-600"),
        buildScale("Doçura", profile.perfil_sensorial?.docura, ["seco", "meio-seco", "meio-doce", "doce"], "bg-gradient-to-r from-pink-400 to-pink-600"),
        buildScale("Tanino", profile.perfil_sensorial?.tanino, ["baixo", "médio", "alto"], "bg-gradient-to-r from-red-400 to-red-700"),
      ].filter((s): s is SensoryScale => s !== null)
    : [];

  const hasPriceRange =
    typeof profile?.faixa_de_preco?.min === "number" && typeof profile?.faixa_de_preco?.max === "number";

  const hasDistribution = (profile?.distribuicao_tipos?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm shadow-violet-500/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200">Perfil de Gosto</p>
            {client.wineProfileGeneratedAt ? (
              <p className="text-[11px] text-slate-400">
                Atualizado em{" "}
                {format(new Date(client.wineProfileGeneratedAt as string), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">Análise gerada por IA a partir do histórico de compras</p>
            )}
          </div>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-sm shadow-violet-500/30"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          {generateMutation.isPending ? "Gerando..." : profile ? "Atualizar" : "Gerar perfil"}
        </button>
      </div>

      {!profile ? (
        /* Estado vazio */
        <div className="flex flex-col items-center justify-center py-20 text-center gap-5 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
          <div className="relative">
            <div className="p-6 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 rounded-full">
              <Wine className="h-10 w-10 text-violet-500 dark:text-violet-400" />
            </div>
            <div className="absolute -top-1 -right-1 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </div>
          </div>
          <div>
            <p className="font-bold text-slate-700 dark:text-slate-300">Nenhum perfil gerado ainda</p>
            <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
              A IA analisa o histórico de compras e cria um retrato do paladar deste cliente — corpo, doçura, uvas,
              regiões e faixa de preço habitual.
            </p>
          </div>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white text-sm font-semibold disabled:opacity-50 transition-all shadow-md shadow-violet-500/30"
          >
            <Sparkles className="h-4 w-4" />
            {generateMutation.isPending ? "Gerando..." : "Gerar perfil agora"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumo — hero */}
          <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-purple-700 dark:from-violet-800 dark:to-purple-900 rounded-2xl p-6 shadow-lg shadow-violet-500/20">
            <Quote className="absolute -top-2 -right-2 h-24 w-24 text-white/10 rotate-180" />
            <div className="relative">
              <p className="text-[10px] font-black text-violet-200 uppercase tracking-widest mb-2.5">
                Resumo do paladar
              </p>
              <p className="text-[15px] text-white leading-relaxed font-medium">{profile.resumo}</p>

              {!hasDistribution && profile.tipos_preferidos?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {profile.tipos_preferidos.map((tipo, i) => (
                    <span
                      key={tipo}
                      className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full ${
                        i === 0
                          ? "bg-white text-violet-700 shadow-sm"
                          : "bg-white/15 text-white border border-white/20"
                      }`}
                    >
                      {i === 0 && <Wine className="h-3 w-3" />}
                      {tipo}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Distribuição por tipo + perfil sensorial */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasDistribution && profile.distribuicao_tipos && (
              <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                    <ChartPie className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    O que este cliente bebe
                  </p>
                </div>
                <WineTypeDonut data={profile.distribuicao_tipos} />
              </div>
            )}

            {scales.length > 0 && (
              <div
                className={`bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700/60 ${
                  hasDistribution ? "" : "md:col-span-2"
                }`}
              >
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Perfil sensorial</p>
                <div className={`grid grid-cols-1 ${hasDistribution ? "" : "sm:grid-cols-3"} gap-x-6 gap-y-4`}>
                  {scales.map((scale) => (
                    <SensoryScaleRow key={scale.label} scale={scale} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Uvas favoritas */}
            {profile.uvas_favoritas?.length > 0 && (
              <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <Grape className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uvas favoritas</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.uvas_favoritas.map((uva) => (
                    <span
                      key={uva}
                      className="text-xs font-semibold px-2.5 py-1 bg-violet-50 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-100 dark:border-violet-800/40 rounded-full"
                    >
                      {uva}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Regiões favoritas */}
            {profile.regioes_favoritas?.length > 0 && (
              <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regiões favoritas</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.regioes_favoritas.map((regiao) => (
                    <span
                      key={regiao}
                      className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/40 rounded-full"
                    >
                      {regiao}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Faixa de preço */}
            {hasPriceRange && (
              <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Banknote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Faixa de preço habitual
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-xl font-extrabold text-slate-800 dark:text-slate-200">
                    {formatCurrency(profile.faixa_de_preco.min)}
                  </p>
                  <span className="text-sm text-slate-400 font-medium pb-0.5">até</span>
                  <p className="text-xl font-extrabold text-slate-800 dark:text-slate-200">
                    {formatCurrency(profile.faixa_de_preco.max)}
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">por garrafa, com base nas últimas compras</p>
              </div>
            )}

            {/* Dica para o vendedor */}
            {profile.sugestao_abordagem && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-5 border border-amber-200/60 dark:border-amber-800/40">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">
                    Dica para o vendedor
                  </p>
                </div>
                <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                  {profile.sugestao_abordagem}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
