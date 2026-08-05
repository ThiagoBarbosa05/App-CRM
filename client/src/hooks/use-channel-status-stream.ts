import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { subscribeWaNotifications } from "@/lib/wa-notifications-stream";

interface ConnectionUpdateEvent {
  channelId?: number;
  instanceName: string | null;
  connectionStatus: string;
  reasonLabel?: string | null;
  occurredAt?: string;
  source?: string;
}

/** Qualquer linha de canal que carregue o status da conexão, em qualquer cache. */
interface ChannelLike {
  id?: number;
  evolutionInstanceName?: string | null;
  connectionStatus?: string | null;
}

function matches(row: ChannelLike, event: ConnectionUpdateEvent): boolean {
  if (event.channelId !== undefined && row.id === event.channelId) return true;
  return (
    !!event.instanceName &&
    !!row.evolutionInstanceName &&
    row.evolutionInstanceName === event.instanceName
  );
}

/**
 * Mantém o status de conexão dos canais QR atualizado em TODA a aplicação.
 *
 * Antes, o único assinante de `evolution_connection_update` era o
 * `EvolutionChannelConnect`, que só existe enquanto o diálogo de QR está
 * aberto. Com ele fechado — que é o caso normal — a lista de canais, a caixa de
 * entrada e a tela de atendentes continuavam exibindo o último status carregado
 * (defaults globais: `staleTime: Infinity`), então um canal que caía seguia
 * "Conectado" na tela até um reload manual.
 *
 * Monte uma vez, no shell autenticado. Usa a EventSource compartilhada.
 */
export function useChannelStatusStream(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    return subscribeWaNotifications("evolution_connection_update", (e) => {
      const event = JSON.parse(e.data) as ConnectionUpdateEvent;

      // Listas de canais: patch direto, sem refetch — o evento já traz o valor.
      // As duas convenções de chave convivem no app: as do use-whatsapp.ts
      // (["whatsapp","channels",...]) e as no estilo URL usadas nas páginas.
      for (const key of [
        ["whatsapp", "channels"],
        ["whatsapp", "channels", "campaign"],
        ["/api/whatsapp/channels/directory"],
        ["/api/whatsapp/channels/mine"],
      ]) {
        queryClient.setQueriesData<ChannelLike[]>({ queryKey: key, exact: true }, (rows) =>
          Array.isArray(rows)
            ? rows.map((row) =>
                matches(row, event) ? { ...row, connectionStatus: event.connectionStatus } : row,
              )
            : rows,
        );
      }

      // A tela de atendentes usa outro formato de linha (canal achatado no usuário).
      queryClient.setQueriesData<
        Array<{ channelId?: number | null; channelConnectionStatus?: string | null }>
      >({ queryKey: ["/api/whatsapp/attendants"], exact: true }, (rows) =>
        Array.isArray(rows)
          ? rows.map((row) =>
              event.channelId !== undefined && row.channelId === event.channelId
                ? { ...row, channelConnectionStatus: event.connectionStatus }
                : row,
            )
          : rows,
      );

      if (event.channelId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: ["whatsapp", "channels", event.channelId, "connection-events"],
        });
        queryClient.invalidateQueries({
          queryKey: ["whatsapp", "channels", event.channelId, "live-status"],
        });
      }
    });
  }, [user, queryClient]);
}
