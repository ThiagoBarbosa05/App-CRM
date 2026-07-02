import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type Client } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, Merge, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface MergeClientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onSuccess: () => void;
}

function formatCPF(cpf?: string | null) {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return cpf;
}

function formatPhone(phone?: string | null) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if ((d.length === 13 || d.length === 12) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
}

export function MergeClientsModal({ open, onOpenChange, clients, onSuccess }: MergeClientsModalProps) {
  const [keepId, setKeepId] = useState<string | null>(clients[0]?.id ?? null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!keepId) throw new Error("Selecione o cadastro principal.");
      const others = clients.filter((c) => c.id !== keepId);
      for (const other of others) {
        await apiRequest("POST", `/api/clients/${keepId}/merge/${other.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Cadastros fundidos com sucesso",
        description: `${clients.length} clientes foram unificados em um único cadastro.`,
      });
      onSuccess();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao fundir cadastros",
        description: err?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const keepClient = clients.find((c) => c.id === keepId);
  const othersCount = clients.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Merge className="h-5 w-5 text-primary" />
            Fundir Cadastros
          </DialogTitle>
          <DialogDescription>
            Escolha qual cadastro será o <strong>principal</strong>. Os demais serão fundidos nele — todas as compras, cashback e interações serão transferidas e os registros duplicados serão excluídos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          {clients.map((client) => {
            const isKeep = client.id === keepId;
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => setKeepId(client.id)}
                className={cn(
                  "w-full text-left rounded-xl border-2 p-4 transition-all",
                  isKeep
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-950"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("font-semibold text-sm", isKeep ? "text-primary" : "text-gray-900 dark:text-slate-100")}>
                        {client.name}
                      </span>
                      {client.category && (
                        <Badge variant="outline" className="text-xs py-0">
                          {client.category}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-slate-400">
                      {formatCPF(client.cpf) && <span>CPF {formatCPF(client.cpf)}</span>}
                      {formatPhone(client.phone) && <span>{formatPhone(client.phone)}</span>}
                      {client.email && <span className="truncate">{client.email}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 mt-0.5">
                    {isKeep ? (
                      <div className="flex items-center gap-1 text-primary text-xs font-medium">
                        <Star className="h-3.5 w-3.5 fill-primary" />
                        Principal
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-slate-500">Clique para selecionar</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {keepClient && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              O cadastro de <strong>{keepClient.name}</strong> será mantido.{" "}
              {othersCount === 1
                ? "O outro cadastro será permanentemente excluído"
                : `Os outros ${othersCount} cadastros serão permanentemente excluídos`}{" "}
              após a fusão.
            </span>
          </div>
        )}

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mergeMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mergeMutation.mutate()}
            disabled={!keepId || mergeMutation.isPending}
            className="gap-2"
          >
            {mergeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Fundindo...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Fusão
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
