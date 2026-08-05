import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  ShieldQuestion,
} from "lucide-react";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { extractApiMessage } from "@/lib/api-error";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReasonPromptDialog } from "@/components/restaurant-pdv/reason-prompt-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { RestaurantOrder } from "@shared/schema";

type BlingFields = Pick<
  RestaurantOrder,
  | "id"
  | "status"
  | "clientId"
  | "blingSyncStatus"
  | "blingSalesOrderId"
  | "blingSalesOrderNumber"
  | "blingSyncError"
  | "blingSyncAttempts"
  | "blingSyncAttemptedAt"
  | "blingCheckStatus"
  | "blingCheckDetail"
  | "blingCheckedAt"
  | "blingContactResolution"
>;

const MAX_SYNC_ATTEMPTS = 5;

interface BadgeSpec {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
}

/**
 * O badge combina os dois eixos: o envio (`blingSyncStatus`) e a conferência
 * (`blingCheckStatus`). Um pedido enviado mas com total divergente do da
 * comanda não pode aparecer como "ok" só porque o POST deu certo — é
 * exatamente a divergência que essa coluna existe para mostrar.
 */
function resolveBadge(order: BlingFields): BadgeSpec {
  if (order.blingSyncStatus === "enviado") {
    if (order.blingCheckStatus === "divergente") {
      return {
        label: "Divergente",
        className:
          "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
        icon: AlertTriangle,
      };
    }
    if (order.blingCheckStatus === "ok") {
      const numero = order.blingSalesOrderNumber ?? order.blingSalesOrderId;
      return {
        label: numero ? `Pedido #${numero}` : "Conferido",
        className:
          "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
        icon: CheckCircle2,
      };
    }
    // Enviado mas ainda não conferido (ou a conferência falhou).
    return {
      label: "Enviado",
      className:
        "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
      icon: ShieldQuestion,
    };
  }

  if (order.blingSyncStatus === "bloqueado") {
    return {
      label: "Bloqueado",
      className:
        "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400",
      icon: Lock,
    };
  }

  if (order.blingSyncStatus === "erro") {
    return {
      label: `Erro (${order.blingSyncAttempts}/${MAX_SYNC_ATTEMPTS})`,
      className:
        "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
      icon: AlertTriangle,
    };
  }

  // `pendente` e NULL (comandas anteriores a este campo) caem aqui.
  return {
    label: "Pendente",
    className:
      "bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300",
    icon: Clock,
  };
}

function formatDateTime(value: Date | string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

export function OrderBlingSyncCell({ order }: { order: BlingFields }) {
  const [open, setOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);

  // Só comanda fechada gera pedido de venda; nas demais a coluna é ruído.
  const isRelevant = order.status === "fechada";

  const retry = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/restaurant-pdv/admin/orders/${order.id}/retry-bling-sync`,
      );
      return (await res.json()) as { action: "reenviado" | "conferido" };
    },
    onSuccess: (data) => {
      toast({
        title: data.action === "conferido" ? "Pedido reconferido" : "Reenviado ao Bling",
        description:
          data.action === "conferido"
            ? "O pedido já existia — os valores foram conferidos novamente."
            : "O envio foi refeito; o status será atualizado na lista.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/orders"] });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Não foi possível reenviar",
        description: extractApiMessage(err),
        variant: "destructive",
      });
    },
  });

  const useDefaultContact = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest(
        "POST",
        `/api/restaurant-pdv/admin/orders/${order.id}/use-default-bling-contact`,
        { reason },
      );
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pedido reenviado como Consumidor Final",
        description: "O cliente original continua registrado na comanda e na auditoria.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/orders"] });
      setFallbackOpen(false);
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Não foi possível usar o Consumidor Final",
        description: extractApiMessage(err),
        variant: "destructive",
      });
    },
  });

  if (!isRelevant) {
    return <span className="text-muted-foreground">—</span>;
  }

  const badge = resolveBadge(order);
  const Icon = badge.icon;
  const isSent = order.blingSyncStatus === "enviado";
  const canUseDefaultContact =
    !!order.clientId &&
    !order.blingSalesOrderId &&
    order.blingContactResolution !== "consumidor_final" &&
    (order.blingSyncStatus === "erro" || order.blingSyncStatus === "bloqueado");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
        title="Ver detalhes da sincronização com o Bling"
      >
        <Badge className={badge.className} variant="outline">
          <Icon className="mr-1 h-3 w-3" />
          {badge.label}
        </Badge>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Pedido de venda no Bling</SheetTitle>
            <SheetDescription>
              Situação do envio desta comanda e conferência dos valores.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <Row label="Situação">
              <Badge className={badge.className} variant="outline">
                <Icon className="mr-1 h-3 w-3" />
                {badge.label}
              </Badge>
            </Row>

            {order.blingSyncError && (
              <Row label="Motivo">
                <span className="text-red-600 dark:text-red-400">{order.blingSyncError}</span>
              </Row>
            )}

            {(order.blingSalesOrderNumber || order.blingSalesOrderId) && (
              <Row label="Pedido no Bling">
                {order.blingSalesOrderNumber
                  ? `Nº ${order.blingSalesOrderNumber} (id ${order.blingSalesOrderId})`
                  : `id ${order.blingSalesOrderId}`}
              </Row>
            )}

            {order.blingCheckDetail && (
              <Row label="Conferência">
                <span
                  className={
                    order.blingCheckStatus === "divergente"
                      ? "text-amber-700 dark:text-amber-400"
                      : undefined
                  }
                >
                  {order.blingCheckDetail}
                </span>
              </Row>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Row label="Último envio">{formatDateTime(order.blingSyncAttemptedAt)}</Row>
              <Row label="Conferido em">{formatDateTime(order.blingCheckedAt)}</Row>
            </div>

            <Button
              className="w-full"
              variant={isSent ? "outline" : "default"}
              disabled={retry.isPending}
              onClick={() => retry.mutate()}
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${retry.isPending ? "animate-spin" : ""}`}
              />
              {retry.isPending
                ? "Processando..."
                : isSent
                  ? "Conferir novamente"
                  : "Reenviar ao Bling"}
            </Button>
            {isSent && (
              <p className="text-xs text-muted-foreground">
                O pedido já existe no Bling — este botão apenas reconfere os valores,
                sem criar um segundo pedido.
              </p>
            )}
            {canUseDefaultContact && (
              <Button
                className="w-full"
                variant="outline"
                disabled={useDefaultContact.isPending}
                onClick={() => setFallbackOpen(true)}
              >
                Enviar como Consumidor Final
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ReasonPromptDialog
        open={fallbackOpen}
        onOpenChange={setFallbackOpen}
        title="Enviar como Consumidor Final?"
        description="A venda aparecerá no Bling como Consumidor Final. O cliente vinculado continuará preservado na comanda e esta decisão será auditada."
        confirmLabel="Autorizar e reenviar"
        isPending={useDefaultContact.isPending}
        onConfirm={(reason) => useDefaultContact.mutate(reason)}
      />
    </>
  );
}
