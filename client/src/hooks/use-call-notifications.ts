import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type CallNotificationEvent = "notification.new" | "call.terminal";

interface UseCallNotificationsOptions {
  onEvent?: (event: CallNotificationEvent, data: unknown) => void;
}

/**
 * Conecta-se ao SSE de `/api/calls/notifications/stream` e invalida queries
 * relevantes ao receber eventos do servidor.
 */
export function useCallNotifications(opts: UseCallNotificationsOptions = {}) {
  const queryClient = useQueryClient();
  const { onEvent } = opts;

  useEffect(() => {
    const source = new EventSource("/api/calls/notifications/stream", {
      withCredentials: true,
    });

    const handle = (eventName: CallNotificationEvent) => (e: MessageEvent) => {
      let data: unknown = null;
      try {
        data = JSON.parse(e.data);
      } catch {
        data = e.data;
      }
      onEvent?.(eventName, data);

      if (eventName === "notification.new") {
        queryClient.invalidateQueries({
          queryKey: ["/api/calls/notifications"],
        });
      } else if (eventName === "call.terminal") {
        queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      }
    };

    source.addEventListener("notification.new", handle("notification.new"));
    source.addEventListener("call.terminal", handle("call.terminal"));

    return () => source.close();
  }, [queryClient, onEvent]);
}
