import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { decodeCampaignMessageError } from "@shared/whatsapp-error-codes";
import { cn } from "@/lib/utils";

interface CampaignMessageErrorProps {
  /** Conteúdo cru de `whatsapp_campaign_messages.error_message`. */
  errorMessage: string | null | undefined;
  className?: string;
}

/**
 * Exibe o motivo da falha de uma mensagem de campanha.
 *
 * Antes esta informação era o texto cru gravado no banco — na prática, o corpo
 * de erro JSON da Meta ou do gateway — jogado direto na tela. Agora o código
 * gravado vira uma frase em português com orientação, e o texto do provedor só
 * aparece se o usuário abrir "Ver detalhe técnico". Linhas antigas, gravadas
 * antes do código existir, continuam sendo exibidas como texto.
 */
export function CampaignMessageError({
  errorMessage,
  className,
}: CampaignMessageErrorProps) {
  const [showDetail, setShowDetail] = useState(false);
  const decoded = decodeCampaignMessageError(errorMessage);

  if (!decoded.info && !decoded.detail) return null;

  // Sem código reconhecido: linha legada, o texto cru é tudo o que existe.
  if (!decoded.info) {
    return (
      <p className={cn("text-xs text-red-500 whitespace-pre-wrap break-words", className)}>
        {decoded.detail}
      </p>
    );
  }

  const attemptLabel =
    decoded.attempt && decoded.maxAttempts
      ? ` (tentativa ${decoded.attempt} de ${decoded.maxAttempts})`
      : "";

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-red-500 break-words">
        {decoded.info.message}
        {attemptLabel}
      </p>
      {decoded.info.hint && (
        <p className="text-xs text-muted-foreground break-words">{decoded.info.hint}</p>
      )}
      {decoded.detail && (
        <>
          <button
            type="button"
            onClick={() => setShowDetail((open) => !open)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", showDetail && "rotate-180")}
            />
            {showDetail ? "Ocultar detalhe técnico" : "Ver detalhe técnico"}
          </button>
          {showDetail && (
            <pre className="rounded bg-muted p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
              {decoded.detail}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
