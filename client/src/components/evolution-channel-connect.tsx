import { useEffect, useState, useCallback } from "react";
import { QrCode, Wifi, WifiOff, Loader2, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEvolutionConnect, useEvolutionLogout, type WhatsappChannel } from "@/hooks/use-whatsapp";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  channel: WhatsappChannel;
}

type ConnectionStatus = "disconnected" | "connecting" | "qr" | "connected" | string;

const STATUS_LABEL: Record<string, string> = {
  connected: "Conectado",
  connecting: "Conectando...",
  qr: "Aguardando leitura do QR",
  disconnected: "Desconectado",
};

const STATUS_COLOR: Record<string, string> = {
  connected: "bg-green-500/20 text-green-700 border-green-300",
  connecting: "bg-yellow-500/20 text-yellow-700 border-yellow-300",
  qr: "bg-blue-500/20 text-blue-700 border-blue-300",
  disconnected: "bg-muted text-muted-foreground border-border",
};

export function EvolutionChannelConnect({ channel }: Props) {
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(channel.connectionStatus ?? "disconnected");
  const connect = useEvolutionConnect();
  const logout = useEvolutionLogout();
  const queryClient = useQueryClient();

  const handleConnect = useCallback(async () => {
    setStatus("connecting");
    setQrBase64(null);
    try {
      const result = await connect.mutateAsync(channel.id);
      if (result.base64) {
        setQrBase64(result.base64);
        setStatus("qr");
      }
    } catch {
      setStatus("disconnected");
    }
  }, [connect, channel.id]);

  // Auto-dispara a geração do QR quando o canal está desconectado
  useEffect(() => {
    if (status === "disconnected") {
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
      setQrBase64(data.base64);
      setStatus("qr");
    });

    es.addEventListener("evolution_connection_update", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        instanceName: string;
        connectionStatus: string;
      };
      if (data.instanceName !== channel.evolutionInstanceName) return;
      setStatus(data.connectionStatus);
      if (data.connectionStatus === "connected") {
        setQrBase64(null);
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "channels"] });
      }
    });

    return () => es.close();
  }, [channel.evolutionInstanceName, queryClient]);

  const handleLogout = useCallback(async () => {
    await logout.mutateAsync(channel.id);
    setStatus("disconnected");
    setQrBase64(null);
  }, [logout, channel.id]);

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
            disabled={connect.isPending || isConnecting}
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
    </div>
  );
}
