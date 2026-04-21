import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, RefreshCw, Wine } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
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
}

interface ClientProp {
  id: string;
  name: string;
  wineProfile?: unknown;
  wineProfileGeneratedAt?: Date | string | null;
}

export function ClientWineProfileTab({ client }: { client: ClientProp }) {
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${client.id}/generate-wine-profile`, { method: "POST" });
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200">Perfil de Gosto</p>
            {client.wineProfileGeneratedAt && (
              <p className="text-[11px] text-slate-400">
                Atualizado em{" "}
                {format(new Date(client.wineProfileGeneratedAt as string), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          {generateMutation.isPending ? "Gerando..." : profile ? "Atualizar" : "Gerar perfil"}
        </button>
      </div>

      {!profile ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-full">
            <Wine className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhum perfil gerado</p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
              Clique em "Gerar perfil" para criar uma análise do gosto deste cliente com base no histórico de compras.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-violet-100/60 dark:border-violet-800/40">
            <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2">Resumo do perfil</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{profile.resumo}</p>
          </div>

          {/* Perfil sensorial */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Corpo", value: profile.perfil_sensorial?.corpo, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
              { label: "Doçura", value: profile.perfil_sensorial?.docura, color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
              ...(profile.perfil_sensorial?.tanino ? [{ label: "Tanino", value: profile.perfil_sensorial.tanino, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" }] : []),
            ].map((attr) => attr.value ? (
              <div key={attr.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">{attr.label}</p>
                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-lg capitalize ${attr.color}`}>{attr.value}</span>
              </div>
            ) : null)}
          </div>

          {/* Tipos preferidos */}
          {profile.tipos_preferidos?.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">Tipos preferidos</p>
              <div className="flex flex-wrap gap-2">
                {profile.tipos_preferidos.map((tipo) => (
                  <span key={tipo} className="text-xs font-bold px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-slate-700 dark:text-slate-300 shadow-sm">
                    {tipo}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Uvas favoritas */}
            {profile.uvas_favoritas?.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">Uvas favoritas</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.uvas_favoritas.map((uva) => (
                    <span key={uva} className="text-xs font-semibold px-2 py-0.5 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 rounded-full">{uva}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Regiões favoritas */}
            {profile.regioes_favoritas?.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">Regiões favoritas</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.regioes_favoritas.map((regiao) => (
                    <span key={regiao} className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full">{regiao}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Faixa de preço */}
          {profile.faixa_de_preco && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100/60 dark:border-emerald-800/40">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1">Faixa de preço habitual</p>
              <p className="text-lg font-extrabold text-emerald-800 dark:text-emerald-300">
                R$ {profile.faixa_de_preco.min.toFixed(0)} – R$ {profile.faixa_de_preco.max.toFixed(0)}
              </p>
            </div>
          )}

          {/* Sugestão de abordagem */}
          {profile.sugestao_abordagem && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100/60 dark:border-amber-800/40">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1.5">Dica para o vendedor</p>
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{profile.sugestao_abordagem}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
