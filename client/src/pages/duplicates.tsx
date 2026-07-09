import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Users,
  Mail,
  CreditCard,
  UserCheck,
  Merge,
  Phone,
  SearchIcon,
  SlidersHorizontal,
  Zap,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useRef } from "react";

type SearchField = "cpf" | "email" | "phone" | "name";

interface DuplicateClient {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  categoria: string;
  responsavelName: string | null;
  createdAt: string;
  matchReasons: string[];
  score: number;
}

interface DuplicateGroup {
  key: string;
  reason: string;
  clients: DuplicateClient[];
}


interface BulkProgress {
  total: number;
  done: number;
  errors: number;
  running: boolean;
  finished: boolean;
}

const FIELD_OPTIONS: { id: SearchField; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "cpf",
    label: "CPF / CNPJ",
    icon: <CreditCard className="h-4 w-4" />,
    description: "Documentos idênticos",
  },
  {
    id: "email",
    label: "E-mail",
    icon: <Mail className="h-4 w-4" />,
    description: "Endereços de e-mail iguais",
  },
  {
    id: "phone",
    label: "Celular",
    icon: <Phone className="h-4 w-4" />,
    description: "Números de telefone idênticos",
  },
  {
    id: "name",
    label: "Nome Similar",
    icon: <UserCheck className="h-4 w-4" />,
    description: "Nomes com ≥75% de similaridade",
  },
];

const reasonIcon = (reason: string) => {
  if (reason.includes("CPF") || reason.includes("CNPJ")) return <CreditCard className="h-3.5 w-3.5" />;
  if (reason.includes("E-mail")) return <Mail className="h-3.5 w-3.5" />;
  if (reason.includes("Celular")) return <Phone className="h-3.5 w-3.5" />;
  if (reason.includes("Nome")) return <UserCheck className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
};

const reasonColor = (reason: string) => {
  if (reason.includes("CPF") || reason.includes("CNPJ"))
    return "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300";
  if (reason.includes("E-mail"))
    return "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300";
  if (reason.includes("Celular"))
    return "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300";
  return "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300";
};

async function mergeOnePair(keepId: string, mergeId: string): Promise<void> {
  const res = await fetch(`/api/clients/${keepId}/merge/${mergeId}`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Erro ao unificar");
  }
}

export default function DuplicatesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedFields, setSelectedFields] = useState<SearchField[]>(["cpf", "email", "phone"]);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [activeFields, setActiveFields] = useState<SearchField[]>([]);
  const [groupSelections, setGroupSelections] = useState<Record<string, string>>({});
  const [mergeGroup, setMergeGroup] = useState<DuplicateClient[] | null>(null);
  const [selectedKeepId, setSelectedKeepId] = useState<string | null>(null);
  const [confirmingGroupKey, setConfirmingGroupKey] = useState<string | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulk, setBulk] = useState<BulkProgress>({ total: 0, done: 0, errors: 0, running: false, finished: false });
  const abortRef = useRef(false);

  const fieldsParam = activeFields.join(",");

  const { data: groups = [], isLoading, isFetching, refetch } = useQuery<DuplicateGroup[]>({
    queryKey: ["/api/clients/duplicates", fieldsParam],
    queryFn: async () => {
      const res = await fetch(`/api/clients/duplicates?fields=${encodeURIComponent(fieldsParam)}`);
      if (!res.ok) throw new Error("Erro ao buscar duplicatas");
      return res.json();
    },
    enabled: searchTriggered && activeFields.length > 0,
  });

  const toggleField = (field: SearchField) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  };

  const handleSearch = () => {
    if (selectedFields.length === 0) {
      toast({ title: "Selecione ao menos um campo para buscar", variant: "destructive" });
      return;
    }
    setActiveFields([...selectedFields]);
    setSearchTriggered(true);
    setBulk({ total: 0, done: 0, errors: 0, running: false, finished: false });
    setTimeout(() => refetch(), 0);
  };

  // Calcula pares a unificar: para cada grupo, mantém o [0] e mescla todos os demais
  const buildMergePairs = (gs: DuplicateGroup[]) => {
    const pairs: { keepId: string; keepName: string; mergeId: string; mergeName: string }[] = [];
    for (const g of gs) {
      const keep = g.clients[0];
      for (let i = 1; i < g.clients.length; i++) {
        pairs.push({ keepId: keep.id, keepName: keep.name, mergeId: g.clients[i].id, mergeName: g.clients[i].name });
      }
    }
    return pairs;
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
        await mergeOnePair(pair.keepId, pair.mergeId);
        done++;
      } catch {
        errors++;
        done++;
      }
      setBulk((prev) => ({ ...prev, done, errors }));
    }

    setBulk({ total: pairs.length, done, errors, running: false, finished: true });

    if (errors === 0) {
      toast({ title: `${done} duplicata${done > 1 ? "s" : ""} unificada${done > 1 ? "s" : ""} com sucesso!` });
    } else {
      toast({
        title: `Concluído com ${errors} erro${errors > 1 ? "s" : ""}`,
        description: `${done - errors} unificados, ${errors} falharam.`,
        variant: "destructive",
      });
    }

    queryClient.invalidateQueries({ queryKey: ["/api/clients/duplicates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    refetch();
  };

  const totalDuplicatesToRemove = buildMergePairs(groups).length;
  const totalClientsInvolved = Array.from(new Set(groups.flatMap((g) => g.clients.map((c) => c.id)))).length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Duplicatas de Clientes
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Encontre e unifique cadastros duplicados no sistema.
            </p>
          </div>
        </div>
        {searchTriggered && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching || bulk.running}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}
      </div>

      {/* Filtro de campos */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <SlidersHorizontal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-sm">Buscar duplicatas por:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FIELD_OPTIONS.map((opt) => {
            const checked = selectedFields.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleField(opt.id)}
                className={`flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all cursor-pointer ${
                  checked
                    ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <Checkbox
                  checked={checked}
                  className="mt-0.5 shrink-0 pointer-events-none"
                />
                <div className="min-w-0">
                  <div className={`flex items-center gap-1.5 font-medium text-sm ${checked ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>
                    {opt.icon}
                    {opt.label}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {selectedFields.length === 0
              ? "Selecione ao menos um campo"
              : `${selectedFields.length} critério${selectedFields.length > 1 ? "s" : ""} selecionado${selectedFields.length > 1 ? "s" : ""}`}
          </p>
          <Button
            onClick={handleSearch}
            disabled={selectedFields.length === 0 || isFetching || bulk.running}
            className="bg-amber-600 hover:bg-amber-700 text-white border-0"
          >
            {isFetching ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <SearchIcon className="h-4 w-4 mr-2" />
            )}
            Buscar Duplicatas
          </Button>
        </div>
      </div>

      {/* Progresso do bulk merge */}
      {(bulk.running || bulk.finished) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {bulk.running ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {bulk.running
                  ? `Unificando… ${bulk.done} de ${bulk.total}`
                  : `Concluído: ${bulk.done - bulk.errors} unificados${bulk.errors > 0 ? `, ${bulk.errors} com erro` : ""}`}
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
      {!searchTriggered ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
            <SearchIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Configure os filtros acima</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">e clique em "Buscar Duplicatas" para começar</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
            <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Nenhuma duplicata encontrada
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Todos os clientes parecem únicos para os critérios selecionados.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats + Unificar Todos */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="grid grid-cols-3 gap-4 flex-1">
              {[
                {
                  label: "Grupos encontrados",
                  value: groups.length,
                  color: "text-amber-700 dark:text-amber-400",
                },
                {
                  label: "Clientes envolvidos",
                  value: totalClientsInvolved,
                  color: "text-orange-700 dark:text-orange-400",
                },
                {
                  label: "Serão removidos",
                  value: totalDuplicatesToRemove,
                  color: "text-red-700 dark:text-red-400",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Botão Unificar Todos */}
            <div className="flex items-stretch">
              <button
                onClick={() => setShowBulkConfirm(true)}
                disabled={bulk.running || isFetching}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 dark:text-red-400 px-5 py-4 transition-all min-w-[140px] cursor-pointer"
              >
                <Zap className="h-6 w-6" />
                <span className="text-sm font-bold text-center leading-tight">
                  Unificar<br />Todos
                </span>
                <span className="text-[10px] text-red-500 dark:text-red-500 font-medium">
                  {totalDuplicatesToRemove} remoção{totalDuplicatesToRemove !== 1 ? "ões" : ""}
                </span>
              </button>
            </div>
          </div>

          {/* Grupos */}
          <div className="space-y-4">
            {groups.map((group) => {
              const keepId = groupSelections[group.key] ?? group.clients[0].id;
              const isConfirming = confirmingGroupKey === group.key;
              return (
                <div
                  key={group.key}
                  className={`rounded-xl border p-5 space-y-4 ${reasonColor(group.reason)}`}
                >
                  <div className="flex items-center gap-2">
                    {reasonIcon(group.reason)}
                    <span className="text-sm font-semibold">{group.reason}</span>
                    <Badge className="ml-auto text-[10px] bg-white/60 dark:bg-black/20 border-current text-current hover:bg-white/60">
                      {group.clients.length} clientes
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 -mt-2">
                    👇 Clique no cadastro que deseja <strong>manter</strong> como principal
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.clients.map((client) => {
                      const isKeep = client.id === keepId;
                      return (
                        <button
                          key={client.id}
                          type="button"
                          disabled={bulk.running}
                          onClick={() => {
                            setGroupSelections((prev) => ({ ...prev, [group.key]: client.id }));
                            setConfirmingGroupKey(null);
                          }}
                          className={`rounded-lg border-2 p-4 text-left transition-all w-full ${
                            isKeep
                              ? "bg-white dark:bg-slate-900 border-green-400 dark:border-green-600 ring-2 ring-green-200 dark:ring-green-900 cursor-default"
                              : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isKeep ? (
                                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100">
                                    ★ PRINCIPAL
                                  </Badge>
                                ) : (
                                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100">
                                    clique para selecionar
                                  </Badge>
                                )}
                                <p className={`text-sm font-semibold truncate ${isKeep ? "text-green-800 dark:text-green-300" : "text-slate-600 dark:text-slate-400"}`}>
                                  {client.name}
                                </p>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{client.phone}</p>
                              {client.email && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{client.email}</p>
                              )}
                              {client.cpf && (
                                <p className="text-xs text-slate-400 dark:text-slate-500">Doc: {client.cpf}</p>
                              )}
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                                Cadastrado{" "}
                                {format(new Date(client.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                                {client.responsavelName && ` · ${client.responsavelName}`}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${client.id}`); }}
                              title="Abrir perfil"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Botão confirmar unificação */}
                  {!isConfirming ? (
                    <Button
                      size="sm"
                      disabled={bulk.running}
                      className="w-full bg-red-600 hover:bg-red-700 text-white gap-2"
                      onClick={() => setConfirmingGroupKey(group.key)}
                    >
                      <Merge className="h-4 w-4" />
                      Unificar — manter <strong className="ml-1">{group.clients.find(c => c.id === keepId)?.name}</strong>
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setConfirmingGroupKey(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                        disabled={bulk.running}
                        onClick={async () => {
                          const others = group.clients.filter((c) => c.id !== keepId);
                          try {
                            for (const other of others) {
                              await mergeOnePair(keepId, other.id);
                            }
                            toast({ title: "Clientes unificados com sucesso!" });
                            queryClient.invalidateQueries({ queryKey: ["/api/clients/duplicates"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
                            refetch();
                          } catch (e: unknown) {
                            toast({ title: "Erro ao unificar", description: (e as Error).message, variant: "destructive" });
                          } finally {
                            setConfirmingGroupKey(null);
                          }
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Confirmar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Diálogo: Unificar par — com seleção do cadastro principal */}
      <Dialog
        open={!!mergeGroup}
        onOpenChange={(open) => { if (!open) { setMergeGroup(null); setSelectedKeepId(null); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5 text-amber-600" />
              Escolha o cadastro principal
            </DialogTitle>
            <DialogDescription>
              Clique no cadastro que deseja <strong>manter</strong>. O outro será removido e todos os seus dados transferidos para o principal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-1">
            {(mergeGroup ?? []).map((client) => {
              const isKeep = client.id === selectedKeepId;
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setSelectedKeepId(client.id)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    isKeep
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${isKeep ? "text-green-800 dark:text-green-300" : "text-slate-800 dark:text-slate-100"}`}>
                          {client.name}
                        </span>
                        {client.categoria && (
                          <Badge variant="outline" className="text-xs py-0">{client.categoria}</Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {client.cpf && <span>CPF {client.cpf}</span>}
                        {client.phone && <span>{client.phone}</span>}
                        {client.email && <span className="truncate">{client.email}</span>}
                        <span>Cadastrado {format(new Date(client.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                    </div>
                    <div className="shrink-0 mt-0.5">
                      {isKeep ? (
                        <Badge className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100">
                          ★ PRINCIPAL
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">clique para selecionar</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Esta ação é <strong>irreversível</strong>. O cadastro não selecionado será removido permanentemente após a fusão.</span>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setMergeGroup(null); setSelectedKeepId(null); }}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={!selectedKeepId}
              onClick={async () => {
                if (!mergeGroup || !selectedKeepId) return;
                const others = mergeGroup.filter((c) => c.id !== selectedKeepId);
                try {
                  for (const other of others) {
                    await mergeOnePair(selectedKeepId, other.id);
                  }
                  toast({ title: "Clientes unificados com sucesso!" });
                  queryClient.invalidateQueries({ queryKey: ["/api/clients/duplicates"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
                  refetch();
                } catch (e: unknown) {
                  toast({ title: "Erro ao unificar", description: (e as Error).message, variant: "destructive" });
                } finally {
                  setMergeGroup(null);
                  setSelectedKeepId(null);
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirmar Unificação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Unificar Todos */}
      <AlertDialog open={showBulkConfirm} onOpenChange={(open) => !open && setShowBulkConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-red-600" />
              Unificar todos os grupos
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  Serão realizadas{" "}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {totalDuplicatesToRemove} unificaç{totalDuplicatesToRemove !== 1 ? "ões" : "ão"}
                  </strong>{" "}
                  em{" "}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {groups.length} grupo{groups.length !== 1 ? "s" : ""}
                  </strong>
                  .
                </p>
                <p>
                  Em cada grupo, o <span className="font-semibold text-green-700 dark:text-green-400">primeiro cadastrado</span> será mantido e os demais serão removidos, com todos os seus dados transferidos.
                </p>
                <p className="text-red-600 dark:text-red-400 font-medium">
                  Esta ação é irreversível e pode demorar alguns instantes.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleBulkMerge}
            >
              <Zap className="h-4 w-4 mr-2" />
              Confirmar e Unificar Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
