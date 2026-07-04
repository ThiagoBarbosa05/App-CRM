import { AlertCircle, CheckCircle2, Key, Loader2, RefreshCcw, ShieldAlert, Sparkles, Thermometer, Zap } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  useOpenAIStatus,
  useOpenAIConfig,
  useTestOpenAIConnection,
} from "@/hooks/use-openai-status";

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

function ConfigRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${mono ? "font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export function OpenAIIntegrationManagement() {
  const { data: status, isLoading } = useOpenAIStatus();
  const { data: config, isLoading: isLoadingConfig } = useOpenAIConfig();
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
    ? { label: "Não configurado", className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300" }
    : status.lastCheckedAt === null
      ? { label: "Não testado", className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300" }
      : status.connected
        ? { label: "Conectado", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" }
        : { label: "Erro de conexão", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400" };

  return (
    <div className="space-y-4">
      {/* Card principal — status */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">OpenAI</CardTitle>
              <CardDescription className="mt-0.5">
                Geração de conteúdo com IA para clientes, produtos e chatbot.
              </CardDescription>
            </div>
          </div>
          {!isLoading && <Badge className={badge.className}>{badge.label}</Badge>}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Alertas de status */}
          {!status?.configured && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Configure a variável de ambiente <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">OPENAI_API_KEY</code> para habilitar a integração.
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

          {/* Chave de API */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center gap-3">
            <Key className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Chave de API (OPENAI_API_KEY)</p>
              {isLoadingConfig ? (
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              ) : config?.keyHint ? (
                <p className="font-mono text-sm font-medium text-slate-700 dark:text-slate-200">{config.keyHint}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">Não configurada</p>
              )}
            </div>
            {!isLoading && (
              <Badge variant="outline" className={status?.configured
                ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                : "border-slate-300 text-slate-500"}>
                {status?.configured ? "Presente" : "Ausente"}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Teste de conexão */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Último teste de conexão</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(status?.lastCheckedAt ?? null)}</p>
            </div>
            <Button
              onClick={handleTestConnection}
              disabled={testMutation.isPending || !status?.configured}
              variant="outline"
              size="sm"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4 mr-2" />
              )}
              Testar conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card de configuração técnica */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-500" />
            Configuração dos Modelos
          </CardTitle>
          <CardDescription>Parâmetros ativos utilizados nas chamadas à API.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingConfig ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex justify-between py-2">
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : config && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ConfigRow label="Modelo — chat / mensagens" value={config.models.chat} mono />
              <ConfigRow label="Modelo — teste de conexão" value={config.models.test} mono />
              <ConfigRow label="Modelo — perfil IA" value={config.models.profile} mono />
              <ConfigRow label="Temperatura padrão" value={String(config.defaults.temperature)} mono />
              <ConfigRow label="Máx. de tokens padrão" value={String(config.defaults.maxTokens)} mono />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card de usos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-purple-500" />
            Onde a IA é usada no sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingConfig ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {(config?.uses ?? []).map((use, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                  {use}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
