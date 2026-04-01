import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
import { useBlingVendedores, useSyncBlingVendors } from "@/hooks/use-bling-vendors-sync";

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

export function LinkBlingVendorModal({ user, open, onOpenChange }: LinkBlingVendorModalProps) {
  const UNLINKED = "__none__";
  const [selectedVendorId, setSelectedVendorId] = useState<string>(UNLINKED);

  const { data: blingVendedores, isLoading, error } = useBlingVendedores();
  const syncMutation = useSyncBlingVendors();

  const isNoBlingAccount =
    error && (error as Error & { status?: number }).status === 422;

  // Sincroniza o select com o valor salvo do usuário ao abrir
  useEffect(() => {
    if (open) {
      setSelectedVendorId(user.blingVendedorId ?? UNLINKED);
    }
  }, [open, user.blingVendedorId]);

  function handleSave() {
    const isUnlinked = selectedVendorId === UNLINKED;
    const selected = blingVendedores?.find((v) => String(v.id) === selectedVendorId);
    syncMutation.mutate(
      [{
        userId: user.id,
        blingVendedorId: isUnlinked ? null : selectedVendorId,
        blingVendedorName: isUnlinked ? null : (selected?.contato.nome ?? null),
      }],
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Vendedor Bling</DialogTitle>
          <DialogDescription>
            Selecione o vendedor do Bling correspondente a <strong>{user.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {isNoBlingAccount && (
            <Alert variant="destructive">
              <AlertDescription>
                Nenhuma conta Bling conectada. Configure uma conta na aba{" "}
                <strong>Contas Bling</strong> antes de vincular vendedores.
              </AlertDescription>
            </Alert>
          )}

          {error && !isNoBlingAccount && (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          <Select
            value={selectedVendorId}
            onValueChange={setSelectedVendorId}
            disabled={isLoading || !!isNoBlingAccount}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? "Carregando vendedores..." : "— Não vinculado —"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNLINKED}>— Não vinculado —</SelectItem>
              {blingVendedores?.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.contato.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={syncMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={syncMutation.isPending || !!isNoBlingAccount}
          >
            {syncMutation.isPending ? (
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
