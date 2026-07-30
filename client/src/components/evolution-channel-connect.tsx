import { useEffect, useRef, useState, useCallback } from "react";
import { QrCode, Wifi, WifiOff, Loader2, RefreshCw, LogOut, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useEvolutionConnect,
  useEvolutionLogout,
  useChannelConnectionEvents,
  type WhatsappChannel,
} from "@/hooks/use-whatsapp";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { subscribeWaNotifications } from "@/lib/wa-notifications-stream";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";
import { fetchEvolutionQr } from "@/hooks/use-whatsapp";

const EVENT_TYPE_LABEL: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  connecting: "Conectando",
  qr: "Aguardando QR",
};

function ConnectionHistory({ channelId }: { channelId: number }) {
  const { data } = useChannelConnectionEvents(channelId, 10);
  const events = data?.events ?? [];

  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        Histórico de conexão
      </div>
      <ul className="flex flex-col gap-1">
        {events.map((event) => (
          <li key={event.id} className="flex items-baseline gap-2 text-xs">
            <span className="text-muted-foreground shrink-0">
              {format(new Date(event.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
            </span>
            <span className="font-medium">{EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}</span>
            {event.reasonLabel && (
              <span className="text-muted-foreground truncate">{event.reasonLabel}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Tempo máximo aguardando o QR (ou a conexão) antes de destravar a UI e deixar
// o usuário tentar de novo. Deve ser maior que o timeout do backend (30s em
// waitForQr) para dar margem a retries de lock entre réplicas do Autoscale.
const CONNECT_TIMEOUT_MS = 60_000;

interface Props {
  channel: WhatsappChannel;
  onStatusChange?: (status: string) => void;
}

export type ConnectionStatus = "disconnected" | "connecting" | "qr" | "connected" | string;

export const STATUS_LABEL: Record<string, string> = {
  connected: "Conectado",
  connecting: "Conectando...",
  qr: "Aguardando leitura do QR",
  disconnected: "Desconectado",
};

export const STATUS_COLOR: Record<string, string> = {
  connected: "bg-green-500/20 text-green-700 border-green-300",
  connecting: "bg-yellow-500/20 text-yellow-700 border-yellow-300",
  qr: "bg-blue-500/20 text-blue-700 border-blue-300",
  disconnected: "bg-muted text-muted-foreground border-border",
};

export function EvolutionChannelConnect({ channel, onStatusChange }: Props) {
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(channel.connectionStatus ?? "disconnected");
  const [disconnectReason, setDisconnectReason] = useState<string | null>(null);
  const connect = useEvolutionConnect();
  const logout = useEvolutionLogout();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearConnectTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const updateChannelCache = useCallback(
    (connectionStatus: string) => {
      queryClient.setQueryData<WhatsappChannel[]>(
        ["whatsapp", "channels"],
        (channels) =>
          channels?.map((item) =>
            item.id === channel.id ? { ...item, connectionStatus } : item,
          ),
      );
    },
    [channel.id, queryClient],
  );

  // Propaga o status ao vivo para o componente pai (barra de cor do canal)
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => clearConnectTimeout, [clearConnectTimeout]);

  const handleConnect = useCallback(async () => {
    setStatus("connecting");
    setQrBase64(null);
    setDisconnectReason(null);
    clearConnectTimeout();
    // Destrava a UI se nenhum QR/confirmação chegar a tempo (ex.: instância
    // gerenciada por outra réplica do Autoscale, sem lock nesta) — sem isso o
    // botão fica desabilitado para sempre (status preso em "connecting").
    timeoutRef.current = setTimeout(() => {
      setStatus((current) => {
        if (current === "connected") return current;
        toast({
          title: "Não foi possível gerar o QR Code",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
        return "disconnected";
      });
      setQrBase64(null);
    }, CONNECT_TIMEOUT_MS);

    try {
      const result = await connect.mutateAsync(channel.id);
      if (result.connectionStatus === "connected") {
        // Backend respondeu que o canal já estava conectado (idempotência):
        // nada foi reiniciado. Reflete "conectado" em vez de esperar timeout.
        clearConnectTimeout();
        setQrBase64(null);
        setStatus("connected");
        updateChannelCache("connected");
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "channels"] });
      } else if (result.base64) {
        clearConnectTimeout();
        setQrBase64(result.base64);
        setStatus("qr");
      } else if (result.code) {
        clearConnectTimeout();
        setQrCode(result.code);
        setStatus("qr");
      } else if (
        result.connectionStatus === "failed" ||
        result.connectionStatus === "disconnected"
      ) {
        clearConnectTimeout();
        setStatus("disconnected");
        setDisconnectReason(
          result.lastError ?? "O gateway não conseguiu iniciar a sessão.",
        );
      }
      // Sem base64: mantém "connecting" até o timeout acima ou um evento SSE
      // (evolution_qr_updated / evolution_connection_update) resolver o estado.
    } catch {
      clearConnectTimeout();
      setStatus("disconnected");
    }
  }, [connect, channel.id, clearConnectTimeout, queryClient, toast, updateChannelCache]);

  // O webhook/SSE é o caminho rápido. O polling é uma contingência limitada à
  // janela em que o diálogo está aguardando QR/conexão.
  useEffect(() => {
    if (
      status !== "connecting" && status !== "qr"
    ) {
      return;
    }
    const startedAt = Date.now();
    let cancelled = false;
    const poll = async () => {
      if (cancelled || Date.now() - startedAt >= CONNECT_TIMEOUT_MS) return;
      try {
        const result = await fetchEvolutionQr(channel.id);
        if (cancelled) return;
        if (result.connectionStatus === "connected" || result.observedState === "connected") {
          clearConnectTimeout();
          setStatus("connected");
          setQrBase64(null);
          setQrCode(null);
          updateChannelCache("connected");
          queryClient.invalidateQueries({ queryKey: ["whatsapp", "channels"] });
          return;
        }
        if (result.base64 || result.code) {
          setQrBase64(result.base64 ?? null);
          setQrCode(result.code || null);
          setStatus("qr");
        } else if (
          result.observedState === "failed" ||
          result.connectionStatus === "failed" ||
          result.errorCode === "SESSION_INVALID"
        ) {
          clearConnectTimeout();
          setStatus("disconnected");
          setDisconnectReason(
            result.lastError ?? "O gateway não conseguiu abrir a sessão.",
          );
          toast({
            title: "Gateway não conseguiu abrir a sessão",
            description:
              result.lastError ??
              "A conexão não iniciou e nenhum QR foi gerado.",
            variant: "destructive",
          });
          return;
        }
      } catch {
        // SSE pode continuar funcionando; a próxima rodada tenta novamente.
      }
      if (!cancelled) window.setTimeout(poll, 2_500);
    };
    const timer = window.setTimeout(poll, 2_500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    channel.id,
    status,
    clearConnectTimeout,
    queryClient,
    toast,
    updateChannelCache,
  ]);

  useEffect(() => {
    if (!qrCode || qrBase64) return;
    let cancelled = false;
    QRCode.toDataURL(qrCode, { width: 300 })
      .then((dataUrl) => {
        if (!cancelled) setQrBase64(dataUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [qrCode, qrBase64]);

  // NÃO reconectamos automaticamente ao montar. Gerar QR chama forceRestart no
  // backend (apaga credenciais Signal), então abrir o CRM em outro dispositivo
  // derrubaria uma sessão saudável. A tela apenas REFLETE o status atual (prop
  // vinda do banco + eventos SSE abaixo); a reconexão destrutiva só ocorre por
  // clique explícito em "Conectar via QR" (handleConnect no onClick do botão).

  // Mantém o status em sincronia com o banco quando a prop muda (refetch da
  // lista) — cobre o caso do reconcile-baileys-status.job, que corrige o status
  // sem emitir SSE. Mas NÃO atropela um fluxo de conexão em andamento
  // (connecting/qr) iniciado pelo usuário com um valor defasado do refetch:
  // só aceita a prop se ela já confirma "connected" ou se não há fluxo ativo.
  useEffect(() => {
    const incoming = channel.connectionStatus ?? "disconnected";
    setStatus((current) => {
      if ((current === "connecting" || current === "qr") && incoming !== "connected") {
        return current;
      }
      return incoming;
    });
  }, [channel.connectionStatus]);

  // Escuta eventos SSE de QR e conexão para este canal. Usa o stream SSE
  // COMPARTILHADO (uma única conexão para todo o app) — renderizamos um
  // EvolutionChannelConnect por linha de canal, e abrir uma EventSource própria
  // em cada um estourava o limite de conexões SSE do navegador.
  useEffect(() => {
    const unsubQr = subscribeWaNotifications("evolution_qr_updated", (e) => {
      const data = JSON.parse(e.data) as {
        instanceName: string;
        base64: string | null;
        code: string | null;
      };
      if (data.instanceName !== channel.evolutionInstanceName) return;
      clearConnectTimeout();
      setQrBase64(data.base64);
      setQrCode(data.code);
      setStatus("qr");
    });

    const unsubConn = subscribeWaNotifications("evolution_connection_update", (e) => {
      const data = JSON.parse(e.data) as {
        instanceName: string;
        connectionStatus: string;
        reasonLabel?: string | null;
      };
      if (data.instanceName !== channel.evolutionInstanceName) return;
      clearConnectTimeout();
      setStatus(data.connectionStatus);
      updateChannelCache(data.connectionStatus);
      setDisconnectReason(data.connectionStatus === "disconnected" ? data.reasonLabel ?? null : null);
      if (data.connectionStatus === "connected") {
        setQrBase64(null);
        setQrCode(null);
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "channels"] });
      }
      queryClient.invalidateQueries({
        queryKey: ["whatsapp", "channels", channel.id, "connection-events"],
      });
    });

    return () => {
      unsubQr();
      unsubConn();
    };
  }, [
    channel.evolutionInstanceName,
    channel.id,
    queryClient,
    clearConnectTimeout,
    updateChannelCache,
  ]);

  const handleLogout = useCallback(async () => {
    clearConnectTimeout();
    await logout.mutateAsync(channel.id);
    setStatus("disconnected");
    updateChannelCache("disconnected");
    setQrBase64(null);
    setQrCode(null);
    setDisconnectReason(null);
  }, [logout, channel.id, clearConnectTimeout, updateChannelCache]);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting" || status === "qr";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Badge
          variant="outline"
          className={cn("text-xs font-medium", STATUS_COLOR[status] ?? STATUS_COLOR.disconnected)}
        >
          {STATUS_LABEL[status] ?? status}
        </Badge>
      </div>
      {status === "disconnected" && disconnectReason && (
        <p className="text-xs text-muted-foreground">{disconnectReason}</p>
      )}

      {qrBase64 && (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-xs text-muted-foreground text-center">
            Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
          </p>
          <img
            src={qrBase64}
            alt="QR Code WhatsApp"
            className="w-48 h-48 rounded-lg border"
          />
        </div>
      )}

      <div className="flex gap-2">
        {!isConnected && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleConnect}
            disabled={connect.isPending || status === "connecting"}
            className="gap-1.5"
          >
            {isConnecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <QrCode className="h-3.5 w-3.5" />
            )}
            {status === "qr" ? "Atualizar QR" : "Conectar via QR"}
          </Button>
        )}

        {isConnected && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <Wifi className="h-3.5 w-3.5" />
            Conectado — mensagens serão registradas automaticamente
          </div>
        )}

        {(isConnected || isConnecting) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            {logout.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            Desconectar
          </Button>
        )}
      </div>

      <ConnectionHistory channelId={channel.id} />
    </div>
  );
}
