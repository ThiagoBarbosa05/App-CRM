import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, Plus, Search, User, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientResult {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  email: string | null;
}

interface LinkClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  currentClientName?: string | null;
  onLinked: () => void;
}

export function LinkClientDialog({
  open,
  onOpenChange,
  orderId,
  currentClientName,
  onLinked,
}: LinkClientDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [showMiniForm, setShowMiniForm] = useState(false);
  const [miniName, setMiniName] = useState("");
  const [miniPhone, setMiniPhone] = useState("");
  const [miniCpf, setMiniCpf] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (open) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [open]);

  function reset() {
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedClient(null);
    setShowMiniForm(false);
    setMiniName("");
    setMiniPhone("");
    setMiniCpf("");
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  const { data: searchResults = [], isLoading: isSearching } = useQuery<ClientResult[]>({
    queryKey: ["/api/restaurant-pdv/clients/search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.trim().length < 2) return [];
      const res = await apiRequest(
        "GET",
        `/api/restaurant-pdv/clients/search?q=${encodeURIComponent(debouncedQuery.trim())}`,
      );
      return res.json();
    },
    enabled: debouncedQuery.trim().length >= 2,
  });

  const quickCreateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/restaurant-pdv/clients", {
        name: miniName.trim(),
        phone: miniPhone.trim() || null,
        cpf: miniCpf.trim() || null,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Erro ao cadastrar");
      }
      return res.json() as Promise<ClientResult>;
    },
    onSuccess: (client) => {
      setSelectedClient(client);
      setShowMiniForm(false);
      setMiniName("");
      setMiniPhone("");
      setMiniCpf("");
      setSearchQuery("");
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/clients/search"] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (payload: { clientId: string | null; clientName: string | null }) => {
      const res = await apiRequest("PATCH", `/api/restaurant-pdv/orders/${orderId}/client`, payload);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Erro ao vincular");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/orders", orderId] });
      toast({ title: selectedClient ? "Cliente vinculado" : "Cliente removido" });
      onLinked();
      handleClose();
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const showDropdown =
    !selectedClient && debouncedQuery.trim().length >= 2 && !showMiniForm;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Vincular Cliente</DialogTitle>
          <DialogDescription>
            {currentClientName
              ? `Cliente atual: ${currentClientName}`
              : "Busque ou cadastre um cliente para esta mesa."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {selectedClient ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2.5 dark:border-green-800 dark:bg-green-950">
              <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-green-900 dark:text-green-100">
                  {selectedClient.name}
                </p>
                {selectedClient.phone && (
                  <p className="truncate text-xs text-green-700 dark:text-green-300">
                    {selectedClient.phone}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="shrink-0 rounded p-0.5 text-green-600 hover:text-green-800 dark:text-green-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : showMiniForm ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Novo Cliente
              </p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    autoFocus
                    placeholder="Nome completo"
                    value={miniName}
                    onChange={(e) => setMiniName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <Input
                      placeholder="(11) 99999-9999"
                      value={miniPhone}
                      onChange={(e) => setMiniPhone(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <Input
                      placeholder="000.000.000-00"
                      value={miniCpf}
                      onChange={(e) => setMiniCpf(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setShowMiniForm(false);
                    setMiniName("");
                    setMiniPhone("");
                    setMiniCpf("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={miniName.trim().length < 2 || quickCreateMutation.isPending}
                  onClick={() => quickCreateMutation.mutate()}
                >
                  {quickCreateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Nome, telefone ou CPF…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
                {isSearching && (
                  <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {showDropdown && (
                <div className="mt-1 max-h-44 overflow-y-auto rounded-md border bg-popover shadow-md">
                  {searchResults.length === 0 && !isSearching ? (
                    <div className="px-3 py-3 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado
                    </div>
                  ) : (
                    searchResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(client);
                          setSearchQuery("");
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted",
                          "border-b last:border-b-0",
                        )}
                      >
                        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{client.name}</p>
                          {(client.phone || client.cpf) && (
                            <p className="truncate text-xs text-muted-foreground">
                              {client.phone ?? client.cpf}
                            </p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {!showMiniForm && !selectedClient && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => {
                setShowMiniForm(true);
                setSearchQuery("");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Cadastrar novo cliente
            </Button>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {currentClientName && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="order-3 sm:order-1 w-full sm:w-auto text-xs text-destructive hover:text-destructive"
              disabled={linkMutation.isPending}
              onClick={() => linkMutation.mutate({ clientId: null, clientName: null })}
            >
              Remover vínculo
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="order-2 w-full sm:w-auto"
            onClick={handleClose}
            disabled={linkMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="order-1 sm:order-3 w-full sm:w-auto"
            disabled={!selectedClient || linkMutation.isPending}
            onClick={() =>
              selectedClient &&
              linkMutation.mutate({
                clientId: selectedClient.id,
                clientName: selectedClient.name,
              })
            }
          >
            {linkMutation.isPending ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Vinculando...</>
            ) : (
              "Vincular"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
