import { AlertCircle, CheckCircle2, KeyRound, Loader2, RefreshCcw, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useAssertivaStatus,
  useRefreshAssertivaToken,
} from "@/hooks/use-assertiva-status";

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

export function AssertivaIntegrationManagement() {
  const { data: status, isLoading } = useAssertivaStatus();
  const refreshMutation = useRefreshAssertivaToken();
  const { toast } = useToast();

  const handleTestConnection = async () => {
    try {
      const result = await refreshMutation.mutateAsync();
      if (result.connected) {
        toast({
          title: "Conexão com a Assertiva bem-sucedida",
          description: "Novo token de acesso obtido com sucesso.",
        });
      } else {
        toast({
          title: "Falha ao conectar com a Assertiva",
          description: result.lastError ?? "Não foi possível obter um token de acesso.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Falha ao conectar com a Assertiva",
        description: err?.message ?? "Erro desconhecido.",
        variant: "destructive",
      });
    }
  };

  const badge = !status?.configured
    ? { label: "Não configurado", className: "bg-slate-100 text-slate-700 border-slate-200" }
    : status.connected
      ? { label: "Conectado", className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
      : { label: "Erro", className: "bg-red-100 text-red-700 border-red-200" };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Assertiva Soluções
          </CardTitle>
          <CardDescription>
            Autenticação OAuth2 (Client Credentials) usada para consulta de CPF/CNPJ.
          </CardDescription>
        </div>
        {!isLoading && <Badge className={badge.className}>{badge.label}</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.configured && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Configure as variáveis <code>ASSERTIVA_CLIENT_ID</code> e{" "}
              <code>ASSERTIVA_CLIENT_SECRET</code> para habilitar a integração.
            </span>
          </div>
        )}

        {status?.configured && status.lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{status.lastError}</span>
          </div>
        )}

        {status?.configured && status.connected && !status.lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Token de acesso ativo e renovado automaticamente a cada 5 minutos.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Última renovação</p>
            <p className="font-medium">{formatDate(status?.lastRefreshAt ?? null)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Token expira em</p>
            <p className="font-medium">{formatDate(status?.tokenExpiresAt ?? null)}</p>
          </div>
        </div>

        <Button
          onClick={handleTestConnection}
          disabled={refreshMutation.isPending || !status?.configured}
          variant="outline"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4 mr-2" />
          )}
          Testar conexão agora
        </Button>
      </CardContent>
    </Card>
  );
}
