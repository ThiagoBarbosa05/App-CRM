import { useState, useEffect } from "react";
import { Loader2, Store } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useBlingConnections,
  useBlingVendedoresByConnection,
  useUserSellerMappings,
  useSetUserBlingMappings,
  type ConnectionMapping,
} from "@/hooks/use-bling-vendors-sync";

interface User {
  id: string;
  name: string;
  blingVendedorId?: string | null;
}

interface LinkBlingVendorModalProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UNLINKED = "__none__";

function ConnectionRow({
  connectionId,
  connectionName,
  value,
  onChange,
}: {
  connectionId: string;
  connectionName: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const { data: vendors, isLoading } = useBlingVendedoresByConnection(connectionId);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Store className="h-4 w-4 text-orange-500 flex-shrink-0" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
          {connectionName}
        </span>
      </div>
      <div className="w-52 flex-shrink-0">
        <Select value={value} onValueChange={onChange} disabled={isLoading}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={isLoading ? "Carregando..." : "— Não vinculado —"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNLINKED}>— Não vinculado —</SelectItem>
            {vendors?.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                {v.contato.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function LinkBlingVendorModal({ user, open, onOpenChange }: LinkBlingVendorModalProps) {
  const [selections, setSelections] = useState<Map<string, string>>(new Map());

  const { data: connections, isLoading: loadingConnections } = useBlingConnections();
  const { data: existingMappings, isLoading: loadingMappings } = useUserSellerMappings(open ? user.id : null);
  const saveMutation = useSetUserBlingMappings(user.id);

  // Popula estado inicial com mapeamentos já salvos
  useEffect(() => {
    if (!open || !connections) return;

    const next = new Map<string, string>();
    for (const conn of connections) {
      const existing = existingMappings?.find((m) => m.connectionId === conn.id);
      next.set(conn.id, existing ? String(existing.blingVendedorId) : UNLINKED);
    }
    setSelections(next);
  }, [open, connections, existingMappings]);

  function handleSave() {
    if (!connections) return;

    const connectionMappings: ConnectionMapping[] = connections.map((conn) => {
      const val = selections.get(conn.id) ?? UNLINKED;
      return {
        connectionId: conn.id,
        blingVendedorId: val === UNLINKED ? null : val,
        blingVendedorName: null,
      };
    });

    saveMutation.mutate(connectionMappings, { onSuccess: () => onOpenChange(false) });
  }

  const isLoading = loadingConnections || loadingMappings;
  const hasNoConnections = !isLoading && (!connections || connections.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular Vendedor Bling</DialogTitle>
          <DialogDescription>
            Selecione o vendedor do Bling correspondente a <strong>{user.name}</strong> em cada conta conectada.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando contas Bling...</span>
            </div>
          )}

          {hasNoConnections && (
            <Alert variant="destructive">
              <AlertDescription>
                Nenhuma conta Bling conectada. Configure uma conta na aba{" "}
                <strong>Integrações</strong> antes de vincular vendedores.
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && connections && connections.length > 0 && (
            <div className="space-y-3">
              {connections.map((conn) => (
                <ConnectionRow
                  key={conn.id}
                  connectionId={conn.id}
                  connectionName={conn.name}
                  value={selections.get(conn.id) ?? UNLINKED}
                  onChange={(val) =>
                    setSelections((prev) => new Map(prev).set(conn.id, val))
                  }
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || hasNoConnections || isLoading}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
