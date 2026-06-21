import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ChatClient {
  id: string;
  name: string;
  unreadCount?: number | null;
}

interface Options {
  onNewMessage?: () => void;
}

export function useWhatsAppNotifications(
  clientsRef: React.MutableRefObject<ChatClient[]>,
  options: Options = {},
) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(
    localStorage.getItem("wa-sound-unlocked") === "true"
  );
  const onNewMessageRef = useRef(options.onNewMessage);
  onNewMessageRef.current = options.onNewMessage;

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("wa-notify-sound") !== "false";
  });

  useEffect(() => {
    audioRef.current = new Audio("/notification.wav");
    audioRef.current.volume = 0.7;
  }, []);

  function unlockAndPlay() {
    const audio = audioRef.current;
    if (!audio) return;
    audioUnlockedRef.current = true;
    localStorage.setItem("wa-sound-unlocked", "true");
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function playNotificationSound() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  useEffect(() => {
    if (!user) return;

    const es = new EventSource("/api/whatsapp/notifications/stream");

    es.addEventListener("new_whatsapp_inbound", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { clientId: string | null };

      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list-badge", user.id] });

      const client = data.clientId
        ? clientsRef.current.find((c) => c.id === data.clientId)
        : null;

      onNewMessageRef.current?.();

      toast({
        title: "Nova mensagem no WhatsApp",
        description: client?.name ?? "Um cliente enviou uma mensagem",
        duration: 5000,
        action: (
          <button
            onClick={() => navigate("/whatsapp/conversas")}
            className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline whitespace-nowrap"
          >
            Ver conversa
          </button>
        ) as any,
      });

      if (soundEnabled) {
        if (!audioUnlockedRef.current) {
          toast({
            title: "🔔 Ativar notificações sonoras",
            description: "Clique para receber alertas sonoros em novas mensagens",
            duration: 10000,
            action: (
              <button
                onClick={unlockAndPlay}
                className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline whitespace-nowrap"
              >
                Ativar som
              </button>
            ) as any,
          });
        } else {
          playNotificationSound();
        }
      }
    });

    return () => es.close();
  }, [user, queryClient, toast, navigate, soundEnabled, clientsRef]);

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("wa-notify-sound", String(next));
      return next;
    });
  }

  return { soundEnabled, toggleSound };
}
