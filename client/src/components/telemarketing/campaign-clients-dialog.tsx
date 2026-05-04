import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Search, Trash2, UserPlus } from "lucide-react";

type CampaignClientRow = {
  id: string;
  clientId: string;
  status: string;
  clientName: string | null;
  clientPhone: string | null;
};

type Client = {
  id: string;
  name: string;
  phone: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  contactado: "Contactado",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  caixa_postal: "Caixa postal",
  convite_aceito: "Aceito",
  convite_recusado: "Recusado",
  convertido: "Convertido",
  desqualificado: "Desqualificado",
};

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  contactado:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  nao_atendeu:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  convite_aceito:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  convite_recusado:
    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  convertido:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
}

export function CampaignClientsDialog({
  open,
  onClose,
  campaignId,
  campaignName,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);

  const { data: campaignClients = [], isLoading: loadingClients } = useQuery<
    CampaignClientRow[]
  >({
    queryKey: ["/api/campaigns", campaignId, "clients"],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/clients`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar clientes");
      return res.json();
    },
    enabled: open,
  });

  const { data: searchResults = [], isLoading: searching } = useQuery<{
    data: Client[];
  }>({
    queryKey: ["/api/clients", "search", search],
    queryFn: async () => {
      const res = await fetch(
        `/api/clients?search=${encodeURIComponent(search)}&pageSize=20`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Erro ao buscar clientes");
      return res.json();
    },
    enabled: showSearch && search.length >= 2,
  });

  const existingIds = new Set(campaignClients.map((cc) => cc.clientId));
  const available = (searchResults.data ?? []).filter(
    (c) => !existingIds.has(c.id),
  );

  const addMutation = useMutation({
    mutationFn: async (clientIds: string[]) => {
      const res = await fetch(`/api/campaigns/${campaignId}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientIds }),
      });
      if (!res.ok) throw new Error("Erro ao adicionar clientes");
      return res.json();
    },
    onSuccess: (data: { added: number }) => {
      toast({ title: `${data.added} cliente(s) adicionado(s)` });
      setSelected(new Set());
      setSearch("");
      queryClient.invalidateQueries({
        queryKey: ["/api/campaigns", campaignId, "clients"],
      });
    },
    onError: () =>
      toast({ title: "Erro ao adicionar clientes", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch(
        `/api/campaigns/${campaignId}/clients/${clientId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Erro ao remover cliente");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/campaigns", campaignId, "clients"],
      });
    },
  });

  const toggleSelect = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            Clientes — {campaignName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Lista atual */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Na campanha ({campaignClients.length})
            </p>
            {loadingClients ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-3">
                <Loader2 className="size-3.5 animate-spin" />
                Carregando clientes…
              </div>
            ) : campaignClients.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Nenhum cliente adicionado ainda.
              </p>
            ) : (
              campaignClients.map((cc) => (
                <div
                  key={cc.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {cc.clientName ?? cc.clientId}
                    </p>
                    {cc.clientPhone && (
                      <p className="text-xs text-slate-400">{cc.clientPhone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[cc.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {STATUS_LABELS[cc.status] ?? cc.status}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-slate-400 hover:text-red-500"
                      onClick={() => removeMutation.mutate(cc.clientId)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Busca para adicionar */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Adicionar clientes
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowSearch((v) => !v)}
              >
                <Search className="size-3.5" />
                Buscar
              </Button>
            </div>

            {showSearch && (
              <>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou telefone..."
                  className="rounded-xl"
                />

                {search.length >= 2 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {searching ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                        <Loader2 className="size-3.5 animate-spin" />
                        Buscando…
                      </div>
                    ) : available.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">
                        Nenhum resultado
                      </p>
                    ) : (
                      available.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selected.has(c.id)}
                            onCheckedChange={() => toggleSelect(c.id)}
                          />
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            {c.phone && (
                              <p className="text-xs text-slate-400">
                                {c.phone}
                              </p>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {selected.size > 0 && (
                  <Button
                    className="w-full gap-2 rounded-xl"
                    onClick={() => addMutation.mutate(Array.from(selected))}
                    disabled={addMutation.isPending}
                  >
                    <UserPlus className="size-4" />
                    Adicionar {selected.size} cliente(s)
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
