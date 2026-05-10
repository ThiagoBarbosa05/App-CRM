import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";

const DISCONNECTED_STATUSES = ["pending", "expired", "reauth_required", "revoked", "error"] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "pendente",
  expired: "expirada",
  reauth_required: "reautenticação necessária",
  revoked: "revogada",
  error: "com erro",
};

export function BlingStatusBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const { data: accounts } = useBlingAccounts();

  const isAllowed = user?.role === "admin" || user?.role === "gerente";
  if (!isAllowed || dismissed) return null;

  const problematic = (accounts ?? []).filter((a) =>
    DISCONNECTED_STATUSES.includes(a.status as (typeof DISCONNECTED_STATUSES)[number]),
  );

  if (problematic.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />

      <span className="flex-1 min-w-0">
        {problematic.length === 1 ? (
          <>
            A conta Bling{" "}
            <strong className="font-semibold">
              {problematic[0].blingAccountName ?? problematic[0].name}
            </strong>{" "}
            está{" "}
            <span className="font-medium">
              {STATUS_LABELS[problematic[0].status] ?? problematic[0].status}
            </span>
            .{" "}
          </>
        ) : (
          <>
            {problematic.length} contas Bling estão desconectadas:{" "}
            <strong className="font-semibold">
              {problematic
                .map((a) => a.blingAccountName ?? a.name)
                .join(", ")}
            </strong>
            .{" "}
          </>
        )}
        <Link
          href="/configuracoes"
          className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 font-medium transition-colors"
        >
          Reconectar em Configurações
        </Link>
      </span>

      <button
        onClick={() => setDismissed(true)}
        aria-label="Fechar aviso"
        className="shrink-0 rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
