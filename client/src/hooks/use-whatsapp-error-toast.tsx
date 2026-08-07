import { useCallback } from "react";
import { useLocation } from "wouter";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { getWhatsappErrorPresentation } from "@/lib/api-error";
import type { WhatsappErrorInfo } from "@shared/whatsapp-error-codes";

type Scope = WhatsappErrorInfo["scope"];

/**
 * Para onde levar o usuário conforme o `scope` do erro.
 *
 * Só os escopos com uma tela de correção óbvia entram aqui. `campaign`,
 * `audience` e `contact` ficam de fora de propósito: o ajuste é na própria
 * tela em que o erro aconteceu, e um botão levando para outro lugar
 * atrapalharia mais que ajudaria. `system` não tem ação do usuário.
 */
const SCOPE_ACTION: Partial<Record<Scope, { label: string; href: string }>> = {
  channel: { label: "Ver canais", href: "/whatsapp/canais" },
  bot: { label: "Ver bots", href: "/whatsapp/bots" },
};

/**
 * Mostra o erro de uma operação de bot/disparo já traduzido, com um atalho
 * para a tela onde ele se resolve.
 *
 * Substitui o `toast({ ...getWhatsappErrorPresentation(e), variant })` repetido
 * nas telas quando vale oferecer o CTA. Quem só precisa do texto pode seguir
 * usando `getWhatsappErrorPresentation` direto.
 */
export function useWhatsappErrorToast() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  return useCallback(
    (error: unknown, fallbackTitle?: string) => {
      const { title, description, scope } = getWhatsappErrorPresentation(
        error,
        fallbackTitle,
      );
      const target = scope ? SCOPE_ACTION[scope] : undefined;

      // Sem CTA quando o destino é a tela atual — o botão não levaria a lugar
      // nenhum e roubaria a atenção da orientação.
      const showAction = target && !location.startsWith(target.href);

      toast({
        title,
        description,
        variant: "destructive",
        action:
          showAction && target ? (
            <ToastAction altText={target.label} onClick={() => navigate(target.href)}>
              {target.label}
            </ToastAction>
          ) : undefined,
      });
    },
    [toast, navigate, location],
  );
}
