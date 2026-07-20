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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
const CONNECT_TIMEOUT_MS = 35_000;

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
      if (result.base64) {
        clearConnectTimeout();
        setQrBase64(result.base64);
        setStatus("qr");
      }
      // Sem base64: mantém "connecting" até o timeout acima ou um evento SSE
      // (evolution_qr_updated / evolution_connection_update) resolver o estado.
    } catch {
      clearConnectTimeout();
      setStatus("disconnected");
    }
  }, [connect, channel.id, clearConnectTimeout, toast]);

  // Auto-dispara a geração do QR quando o canal não está conectado
  useEffect(() => {
    if (status !== "connected") {
      handleConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escuta eventos SSE de QR e conexão para este canal
  useEffect(() => {
    const es = new EventSource("/api/whatsapp/notifications/stream");

    es.addEventListener("evolution_qr_updated", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        instanceName: string;
        base64: string | null;
        code: string | null;
      };
      if (data.instanceName !== channel.evolutionInstanceName) return;
      clearConnectTimeout();
      setQrBase64(data.base64);
      setStatus("qr");
    });

    es.addEventListener("evolution_connection_update", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        instanceName: string;
        connectionStatus: string;
        reasonLabel?: string | null;
      };
      if (data.instanceName !== channel.evolutionInstanceName) return;
      clearConnectTimeout();
      setStatus(data.connectionStatus);
      setDisconnectReason(data.connectionStatus === "disconnected" ? data.reasonLabel ?? null : null);
      if (data.connectionStatus === "connected") {
        setQrBase64(null);
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "channels"] });
      }
      queryClient.invalidateQueries({
        queryKey: ["whatsapp", "channels", channel.id, "connection-events"],
      });
    });

    return () => es.close();
  }, [channel.evolutionInstanceName, queryClient, clearConnectTimeout]);

  const handleLogout = useCallback(async () => {
    clearConnectTimeout();
    await logout.mutateAsync(channel.id);
    setStatus("disconnected");
    setQrBase64(null);
    setDisconnectReason(null);
  }, [logout, channel.id, clearConnectTimeout]);

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
