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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const reasonIcon = (reason: string) => {
  if (reason.includes("CPF") || reason.includes("CNPJ"))
    return <CreditCard className="h-3.5 w-3.5" />;
  if (reason.includes("E-mail")) return <Mail className="h-3.5 w-3.5" />;
  if (reason.includes("Nome")) return <UserCheck className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
};

const reasonColor = (reason: string) => {
  if (reason.includes("CPF") || reason.includes("CNPJ"))
    return "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300";
  if (reason.includes("E-mail"))
    return "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300";
  return "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300";
};

export default function DuplicatesPage() {
  const [, navigate] = useLocation();

  const { data: groups = [], isLoading, refetch, isFetching } = useQuery<DuplicateGroup[]>({
    queryKey: ["/api/clients/duplicates"],
    queryFn: async () => {
      const res = await fetch("/api/clients/duplicates");
      if (!res.ok) throw new Error("Erro ao buscar duplicatas");
      return res.json();
    },
  });

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
              Clientes com CPF/CNPJ, e-mail ou nome muito similares já cadastrados.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      {!isLoading && (
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
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
            <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Nenhuma duplicata encontrada
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Todos os clientes parecem únicos no sistema.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.key}
              className={`rounded-xl border p-5 space-y-4 ${reasonColor(group.reason)}`}
            >
              {/* Group header */}
              <div className="flex items-center gap-2">
                {reasonIcon(group.reason)}
                <span className="text-sm font-semibold">{group.reason}</span>
                <Badge className="ml-auto text-[10px] bg-white/60 dark:bg-black/20 border-current text-current hover:bg-white/60">
                  {group.clients.length} clientes
                </Badge>
              </div>

              {/* Clients */}
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
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {client.phone}
                      </p>
                      {client.email && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {client.email}
                        </p>
                      )}
                      {client.cpf && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Doc: {client.cpf}
                        </p>
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
                      onClick={() => window.open(`/clientes/${client.id}`, "_blank")}
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
      )}
    </div>
  );
}
