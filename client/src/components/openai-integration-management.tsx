import { AlertCircle, CheckCircle2, Loader2, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react";
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
  useOpenAIStatus,
  useTestOpenAIConnection,
} from "@/hooks/use-openai-status";

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

export function OpenAIIntegrationManagement() {
  const { data: status, isLoading } = useOpenAIStatus();
  const testMutation = useTestOpenAIConnection();
  const { toast } = useToast();

  const handleTestConnection = async () => {
    try {
      const result = await testMutation.mutateAsync();
      if (result.connected) {
        toast({
          title: "Conexão com a OpenAI bem-sucedida",
          description: "A chave de API está ativa e respondendo normalmente.",
        });
      } else {
        toast({
          title: "Falha ao conectar com a OpenAI",
          description: result.lastError ?? "Não foi possível validar a chave de API.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Falha ao conectar com a OpenAI",
        description: err?.message ?? "Erro desconhecido.",
        variant: "destructive",
      });
    }
  };

  const badge = !status?.configured
    ? { label: "Não configurado", className: "bg-slate-100 text-slate-700 border-slate-200" }
    : status.lastCheckedAt === null
      ? { label: "Não testado", className: "bg-slate-100 text-slate-700 border-slate-200" }
      : status.connected
        ? { label: "Conectado", className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
        : { label: "Erro", className: "bg-red-100 text-red-700 border-red-200" };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            OpenAI
          </CardTitle>
          <CardDescription>
            Usada para gerar o perfil de gosto dos clientes, o perfil de IA dos produtos e a
            classificação de intenção do chatbot no WhatsApp.
          </CardDescription>
        </div>
        {!isLoading && <Badge className={badge.className}>{badge.label}</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.configured && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Configure a variável <code>OPENAI_API_KEY</code> para habilitar a integração.
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
            <span>Chave de API válida e respondendo normalmente.</span>
          </div>
        )}

        <div>
          <p className="text-muted-foreground text-sm">Último teste</p>
          <p className="font-medium text-sm">{formatDate(status?.lastCheckedAt ?? null)}</p>
        </div>

        <Button
          onClick={handleTestConnection}
          disabled={testMutation.isPending || !status?.configured}
          variant="outline"
        >
          {testMutation.isPending ? (
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
