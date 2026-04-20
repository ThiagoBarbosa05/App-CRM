import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { useState } from "react";

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

interface MergeTarget {
  keepId: string;
  keepName: string;
  mergeId: string;
  mergeName: string;
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

export default function DuplicatesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedFields, setSelectedFields] = useState<SearchField[]>(["cpf", "email", "phone"]);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [activeFields, setActiveFields] = useState<SearchField[]>([]);
  const [mergeTarget, setMergeTarget] = useState<MergeTarget | null>(null);

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

  const mergeMutation = useMutation({
    mutationFn: async ({ keepId, mergeId }: { keepId: string; mergeId: string }) => {
      const res = await fetch(`/api/clients/${keepId}/merge/${mergeId}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Erro ao unificar clientes.");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Clientes unificados com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setMergeTarget(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao unificar", description: error.message, variant: "destructive" });
      setMergeTarget(null);
    },
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
    setTimeout(() => refetch(), 0);
  };

  const handleRefetch = () => {
    refetch();
  };

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
            onClick={handleRefetch}
            disabled={isFetching}
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
                  id={`field-${opt.id}`}
                  checked={checked}
                  onCheckedChange={() => toggleField(opt.id)}
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
            disabled={selectedFields.length === 0 || isFetching}
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
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Grupos encontrados",
                value: groups.length,
                color: "text-amber-700 dark:text-amber-400",
              },
              {
                label: "Clientes envolvidos",
                value: Array.from(new Set(groups.flatMap((g) => g.clients.map((c) => c.id)))).length,
                color: "text-orange-700 dark:text-orange-400",
              },
              {
                label: "Por CPF/CNPJ",
                value: groups.filter((g) => g.key.startsWith("cpf:")).length,
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

          {/* Grupos */}
          <div className="space-y-4">
            {groups.map((group) => (
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
                  {group.clients.length === 2 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 border-current text-current bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40"
                      onClick={() =>
                        setMergeTarget({
                          keepId: group.clients[0].id,
                          keepName: group.clients[0].name,
                          mergeId: group.clients[1].id,
                          mergeName: group.clients[1].name,
                        })
                      }
                    >
                      <Merge className="h-3 w-3" />
                      Unificar
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {group.clients.map((client, idx) => (
                    <div
                      key={client.id}
                      className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            #{idx + 1}
                          </span>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
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
                        className="h-8 w-8 p-0 shrink-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => navigate(`/clientes/${client.id}`)}
                        title="Abrir perfil"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Diálogo de confirmação de merge */}
      <AlertDialog open={!!mergeTarget} onOpenChange={(open) => !open && setMergeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unificar clientes</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  O cliente{" "}
                  <strong className="text-slate-900 dark:text-slate-100">"{mergeTarget?.mergeName}"</strong>{" "}
                  será removido e todos os seus dados (pedidos, interações, cashback) serão transferidos para{" "}
                  <strong className="text-slate-900 dark:text-slate-100">"{mergeTarget?.keepName}"</strong>.
                </p>
                <p className="text-red-600 dark:text-red-400 font-medium">Esta ação é irreversível.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (mergeTarget) {
                  mergeMutation.mutate({ keepId: mergeTarget.keepId, mergeId: mergeTarget.mergeId });
                }
              }}
            >
              Confirmar Unificação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
