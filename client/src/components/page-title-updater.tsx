import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsappUnreadCount } from "@/hooks/use-whatsapp";

const DEFAULT_TITLE = "CRM - Plataforma B2C";
const WHATSAPP_TITLE = "CRM - Whatsapp";

/**
 * Enquanto o usuário navega em /whatsapp/*, troca o título da aba para
 * mostrar a quantidade de conversas com mensagens não lidas — igual ao
 * WhatsApp Web (ex.: "(3) CRM - Whatsapp"). Some do resto do CRM.
 */
export function PageTitleUpdater() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isWhatsappRoute = location.startsWith("/whatsapp");
  const unreadCount = useWhatsappUnreadCount(user?.id, isWhatsappRoute);

  useEffect(() => {
    if (!isWhatsappRoute) {
      document.title = DEFAULT_TITLE;
      return;
    }
    document.title = unreadCount > 0 ? `(${unreadCount}) ${WHATSAPP_TITLE}` : WHATSAPP_TITLE;
  }, [isWhatsappRoute, unreadCount]);

  return null;
}
