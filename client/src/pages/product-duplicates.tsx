import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Wine,
  Merge,
  SearchIcon,
  Zap,
  CheckCircle2,
  Loader2,
  Package,
  ShoppingCart,
  Building2,
  Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useState, useRef } from "react";
import { getCountryFlag } from "@/lib/country-flags";

interface DuplicateProduct {
  id: string;
  name: string;
  type: string;
  country: string;
  volume: string;
  imageUrl: string | null;
  negotiatedPrice: string;
  createdAt: string;
  normalized_name: string;
  mapping_count: number;
  order_count: number;
  company_count: number;
}

interface DuplicateGroup {
  key: string;
  products: DuplicateProduct[];
}

interface BulkProgress {
  total: number;
  done: number;
  errors: number;
  running: boolean;
  finished: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  TINTO: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  BRANCO: "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  ROSE: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  ESPUMANTE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "PÓS-REFEIÇÃO": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

async function mergeProducts(canonicalId: string, duplicateId: string): Promise<void> {
  const res = await fetch(`/api/products/${canonicalId}/merge/${duplicateId}`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Erro ao mesclar produtos");
  }
}

export default function ProductDuplicatesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [searched, setSearched] = useState(false);
  const [groupSelections, setGroupSelections] = useState<Record<string, string>>({});
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulk, setBulk] = useState<BulkProgress>({ total: 0, done: 0, errors: 0, running: false, finished: false });
  const abortRef = useRef(false);

  const { data: groups = [], isLoading, isFetching, refetch } = useQuery<DuplicateGroup[]>({
    queryKey: ["/api/products/duplicates"],
    queryFn: async () => {
      const res = await fetch("/api/products/duplicates");
      if (!res.ok) throw new Error("Erro ao buscar duplicatas");
      return res.json();
    },
    enabled: searched,
  });

  const buildMergePairs = (gs: DuplicateGroup[]) => {
    const pairs: { keepId: string; keepName: string; mergeId: string; mergeName: string }[] = [];
    for (const g of gs) {
      const keepId = groupSelections[g.key] ?? g.products[0].id;
      const keep = g.products.find((p) => p.id === keepId) ?? g.products[0];
      for (const p of g.products) {
        if (p.id !== keep.id) {
          pairs.push({ keepId: keep.id, keepName: keep.name, mergeId: p.id, mergeName: p.name });
        }
      }
    }
    return pairs;
  };

  const handleSearch = () => {
    setSearched(true);
    setBulk({ total: 0, done: 0, errors: 0, running: false, finished: false });
    setTimeout(() => refetch(), 0);
  };

  const handleBulkMerge = async () => {
    setShowBulkConfirm(false);
    const pairs = buildMergePairs(groups);
    if (pairs.length === 0) return;

    abortRef.current = false;
    setBulk({ total: pairs.length, done: 0, errors: 0, running: true, finished: false });

    let done = 0;
    let errors = 0;

    for (const pair of pairs) {
      if (abortRef.current) break;
      try {
        await mergeProducts(pair.keepId, pair.mergeId);
        done++;
      } catch {
        errors++;
        done++;
      }
      setBulk((prev) => ({ ...prev, done, errors }));
    }

    setBulk({ total: pairs.length, done, errors, running: false, finished: true });

    if (errors === 0) {
      toast({ title: `${done} duplicata${done !== 1 ? "s" : ""} mesclada${done !== 1 ? "s" : ""} com sucesso!` });
    } else {
      toast({
        title: `Concluído com ${errors} erro${errors !== 1 ? "s" : ""}`,
        description: `${done - errors} mesclados, ${errors} falharam.`,
        variant: "destructive",
      });
    }

    queryClient.invalidateQueries({ queryKey: ["/api/products/duplicates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    refetch();
  };

  const totalToRemove = buildMergePairs(groups).length;
  const totalInvolved = Array.from(new Set(groups.flatMap((g) => g.products.map((p) => p.id)))).length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-xl border border-purple-200 dark:border-purple-800">
            <Wine className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Duplicatas de Produtos
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Encontre e mescle vinhos duplicados causados pela sincronização de múltiplas contas Bling.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {searched && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching || bulk.running}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/products")}
          >
            ← Voltar
          </Button>
        </div>
      </div>

      {/* Buscar */}
      {!searched ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 flex flex-col items-center gap-4 text-center">
          <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full">
            <SearchIcon className="h-8 w-8 text-purple-500 dark:text-purple-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Detectar produtos com nomes duplicados
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              O sistema buscará produtos com o mesmo nome (ignorando maiúsculas/minúsculas) e os agrupará para revisão.
            </p>
          </div>
          <Button
            onClick={handleSearch}
            className="bg-purple-600 hover:bg-purple-700 text-white border-0 gap-2"
          >
            <SearchIcon className="h-4 w-4" />
            Buscar Duplicatas
          </Button>
        </div>
      ) : null}

      {/* Progresso bulk */}
      {(bulk.running || bulk.finished) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {bulk.running ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {bulk.running
                  ? `Mesclando… ${bulk.done} de ${bulk.total}`
                  : `Concluído: ${bulk.done - bulk.errors} mesclados${bulk.errors > 0 ? `, ${bulk.errors} com erro` : ""}`}
              </span>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {bulk.total > 0 ? Math.round((bulk.done / bulk.total) * 100) : 0}%
            </span>
          </div>
          <Progress value={bulk.total > 0 ? (bulk.done / bulk.total) * 100 : 0} className="h-2" />
        </div>
      )}

      {/* Resultados */}
      {searched && isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : searched && groups.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
            <Wine className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Nenhuma duplicata encontrada
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Todos os produtos têm nomes únicos no sistema.
            </p>
          </div>
        </div>
      ) : searched && groups.length > 0 ? (
        <>
          {/* Stats + Mesclar Todos */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="grid grid-cols-3 gap-4 flex-1">
              {[
                { label: "Grupos encontrados", value: groups.length, color: "text-purple-700 dark:text-purple-400" },
                { label: "Produtos envolvidos", value: totalInvolved, color: "text-orange-700 dark:text-orange-400" },
                { label: "Serão removidos", value: totalToRemove, color: "text-red-700 dark:text-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-stretch">
              {!showBulkConfirm ? (
                <button
                  onClick={() => setShowBulkConfirm(true)}
                  disabled={bulk.running || isFetching}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 dark:text-red-400 px-5 py-4 transition-all min-w-[140px] cursor-pointer"
                >
                  <Zap className="h-6 w-6" />
                  <span className="text-sm font-bold text-center leading-tight">Mesclar<br />Todos</span>
                  <span className="text-[10px] text-red-500 font-medium">
                    {totalToRemove} remoção{totalToRemove !== 1 ? "ões" : ""}
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-2 rounded-xl border-2 border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-4 py-3 min-w-[180px]">
                  <p className="text-xs font-semibold text-red-800 dark:text-red-300 text-center">Confirmar mescla em massa?</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowBulkConfirm(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" className="flex-1 h-7 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={handleBulkMerge}>
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grupos */}
          <div className="space-y-4">
            {groups.map((group) => {
              const keepId = groupSelections[group.key] ?? group.products[0].id;
              const isConfirming = confirmingKey === group.key;

              return (
                <div key={group.key} className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Wine className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                      Nome idêntico: <span className="italic">"{group.products[0].name}"</span>
                    </span>
                    <Badge className="ml-auto text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700 hover:bg-purple-100">
                      {group.products.length} produtos
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 -mt-2">
                    👇 Clique no produto que deseja <strong>manter</strong> como principal
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.products.map((product) => {
                      const isKeep = product.id === keepId;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          disabled={bulk.running}
                          onClick={() => {
                            setGroupSelections((prev) => ({ ...prev, [group.key]: product.id }));
                            setConfirmingKey(null);
                          }}
                          className={`rounded-lg border-2 p-4 text-left transition-all w-full ${
                            isKeep
                              ? "bg-white dark:bg-slate-900 border-green-400 dark:border-green-600 ring-2 ring-green-200 dark:ring-green-900 cursor-default"
                              : "bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Thumbnail */}
                            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Wine className="h-5 w-5 text-slate-400" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {isKeep ? (
                                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100">
                                    ★ PRINCIPAL
                                  </Badge>
                                ) : (
                                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100">
                                    clique para selecionar
                                  </Badge>
                                )}
                              </div>
                              <p className={`text-sm font-semibold truncate ${isKeep ? "text-green-800 dark:text-green-300" : "text-slate-700 dark:text-slate-300"}`}>
                                {product.name}
                              </p>

                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {product.type && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[product.type] ?? "bg-slate-100 text-slate-600"}`}>
                                    {product.type}
                                  </span>
                                )}
                                {product.country && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {getCountryFlag(product.country)} {product.country}
                                  </span>
                                )}
                                {product.volume && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{product.volume}</span>
                                )}
                              </div>

                              {/* Contadores */}
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`flex items-center gap-1 text-[10px] font-medium ${product.order_count > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}>
                                  <ShoppingCart className="h-3 w-3" />
                                  {product.order_count} pedido{product.order_count !== 1 ? "s" : ""}
                                </span>
                                <span className={`flex items-center gap-1 text-[10px] font-medium ${product.company_count > 0 ? "text-orange-600 dark:text-orange-400" : "text-slate-400 dark:text-slate-500"}`}>
                                  <Building2 className="h-3 w-3" />
                                  {product.company_count} empresa{product.company_count !== 1 ? "s" : ""}
                                </span>
                                <span className={`flex items-center gap-1 text-[10px] font-medium ${product.mapping_count > 0 ? "text-purple-600 dark:text-purple-400" : "text-slate-400 dark:text-slate-500"}`}>
                                  <Link2 className="h-3 w-3" />
                                  {product.mapping_count} Bling
                                </span>
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={(e) => { e.stopPropagation(); navigate(`/products/${product.id}`); }}
                              title="Abrir perfil"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Botão confirmar */}
                  {!isConfirming ? (
                    <Button
                      size="sm"
                      disabled={bulk.running}
                      className="w-full bg-red-600 hover:bg-red-700 text-white gap-2"
                      onClick={() => setConfirmingKey(group.key)}
                    >
                      <Merge className="h-4 w-4" />
                      Mesclar — manter <strong className="ml-1">{group.products.find((p) => p.id === keepId)?.name}</strong>
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmingKey(null)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                        disabled={bulk.running}
                        onClick={async () => {
                          const others = group.products.filter((p) => p.id !== keepId);
                          try {
                            for (const other of others) {
                              await mergeProducts(keepId, other.id);
                            }
                            toast({ title: "Produtos mesclados com sucesso!" });
                            queryClient.invalidateQueries({ queryKey: ["/api/products/duplicates"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                            setConfirmingKey(null);
                            refetch();
                          } catch (e: unknown) {
                            toast({ title: "Erro ao mesclar", description: (e as Error).message, variant: "destructive" });
                            setConfirmingKey(null);
                          }
                        }}
                      >
                        <Merge className="h-4 w-4" />
                        Confirmar mescla
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* Nota informativa */}
      <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 p-4 flex gap-3">
        <Package className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold">O que acontece ao mesclar?</p>
          <p>O produto principal fica ativo. O duplicado é arquivado. Todos os vínculos (pedidos Bling, empresas associadas, mapeamentos de conta Bling) são transferidos para o produto principal.</p>
        </div>
      </div>
    </div>
  );
}
