import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { isOnWaConversationsPage } from "@/lib/wa-active-conversation";
import { subscribeWaNotifications } from "@/lib/wa-notifications-stream";

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
  // Lido dentro do handler SSE via ref para o toggle de som NÃO derrubar e
  // recriar o stream (antes `soundEnabled` estava nas deps do efeito).
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

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

    const unsubscribe = subscribeWaNotifications("new_whatsapp_inbound", (e) => {
      const data = JSON.parse(e.data) as {
        clientId: string | null;
        conversationId?: string | null;
      };

      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list-badge", user.id] });

      onNewMessageRef.current?.();

      // Usuário está na página de conversas: a lista lá já atualiza em tempo
      // real (badge, negrito, preview) — toast/som de qualquer conversa
      // seria redundante, não só da que está aberta.
      if (isOnWaConversationsPage()) return;

      const client = data.clientId
        ? clientsRef.current.find((c) => c.id === data.clientId)
        : null;

      toast({
        title: "Nova mensagem no WhatsApp",
        description: client?.name ?? "Um cliente enviou uma mensagem",
        duration: 5000,
        action: (
          <ToastAction
            altText="Ver conversa"
            onClick={() => navigate("/whatsapp/conversas")}
          >
            Ver conversa
          </ToastAction>
        ),
      });

      if (soundEnabledRef.current) {
        if (!audioUnlockedRef.current) {
          toast({
            title: "🔔 Ativar notificações sonoras",
            description: "Clique para receber alertas sonoros em novas mensagens",
            duration: 10000,
            action: (
              <ToastAction altText="Ativar som" onClick={unlockAndPlay}>
                Ativar som
              </ToastAction>
            ),
          });
        } else {
          playNotificationSound();
        }
      }
    });

    return unsubscribe;
  }, [user, queryClient, toast, navigate, clientsRef]);

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("wa-notify-sound", String(next));
      return next;
    });
  }

  return { soundEnabled, toggleSound };
}
