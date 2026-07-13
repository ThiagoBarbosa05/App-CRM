import { BellOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Banner informativo sobre o mecanismo de opt-out de marketing por WhatsApp,
 * exibido nas páginas de Bots, Templates e Campanhas para que o usuário saiba
 * que clientes que optaram por sair são excluídos automaticamente dos envios.
 */
export function WhatsappOptOutInfoBanner() {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
      <BellOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle>Opt-out de marketing</AlertTitle>
      <AlertDescription className="text-amber-800/90 dark:text-amber-300/90">
        Clientes que respondem <strong>SAIR</strong>, <strong>PARAR</strong>,{" "}
        <strong>CANCELAR</strong> ou <strong>DESCADASTRAR</strong> no WhatsApp (sem diferenciar
        maiúsculas/minúsculas) param de receber campanhas e bots de marketing automaticamente —
        o pedido também pode ser feito manualmente na ficha do cliente, aba WhatsApp. Eles são
        excluídos da seleção de audiência e de qualquer disparo, mesmo que já estejam
        selecionados. O cliente recebe automaticamente o marcador{" "}
        <strong>"Opt-out WhatsApp"</strong> no cadastro, visível na ficha e nos filtros por
        marcador. Respondendo <strong>VOLTAR</strong> ou <strong>QUERO RECEBER</strong>, o
        cliente volta a ser elegível e o marcador é removido.
      </AlertDescription>
    </Alert>
  );
}
